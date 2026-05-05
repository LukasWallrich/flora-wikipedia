source("/Users/lukaswallrich/Documents/Coding/flora-wikipedia/R/00_config.R")

api_url <- function(lang) glue("https://{lang}.wikipedia.org/w/api.php")

mw_request <- function(lang) {
  request(api_url(lang)) |>
    req_user_agent(USER_AGENT) |>
    req_throttle(rate = 180 / 60) |>
    req_retry(
      max_tries = 5,
      backoff = ~ min(2^.x, 30),
      is_transient = function(resp) {
        status <- resp_status(resp)
        if (status %in% c(429, 503)) return(TRUE)
        if (status == 200) {
          body <- tryCatch(resp_body_json(resp), error = function(e) NULL)
          if (!is.null(body$error$code) && body$error$code == "maxlag") return(TRUE)
        }
        FALSE
      }
    )
}

exturl_one <- function(lang, query, max_pages = 5) {
  hits <- list()
  eu_offset <- NULL

  for (i in seq_len(max_pages)) {
    params <- list(
      action      = "query",
      list        = "exturlusage",
      euquery     = query,
      eulimit     = "500",
      euprotocol  = "https",
      eunamespace = "0",
      format      = "json",
      maxlag      = "5"
    )
    if (!is.null(eu_offset)) params$euoffset <- eu_offset

    resp <- mw_request(lang) |>
      req_url_query(!!!params) |>
      req_perform()

    body <- resp_body_json(resp)

    if (!is.null(body$error)) {
      cli_alert_warning("API error for query={query} on {lang}: {body$error$code}")
      break
    }

    chunk <- body$query$exturlusage
    if (length(chunk) > 0) hits <- c(hits, chunk)

    if (is.null(body$continue$euoffset)) break
    eu_offset <- body$continue$euoffset
  }

  hits
}

# Wikipedia's {{cite}} templates URL-encode the DOI's `/` to `%2F`.
# Many older citations store the literal `/`. Query both forms and dedupe.
# Also include `dx.doi.org` aliases.
doi_query_variants <- function(doi) {
  encoded <- str_replace_all(doi, "/", "%2F")
  unique(c(
    paste0("doi.org/", doi),
    paste0("doi.org/", encoded)
  ))
}

exturl_for_doi <- function(lang, doi) {
  variants <- doi_query_variants(doi)
  hits <- unlist(lapply(variants, function(q) exturl_one(lang, q)), recursive = FALSE)

  if (length(hits) == 0) {
    return(tibble(
      lang = character(), doi = character(),
      pageid = integer(), page_title = character(),
      url_hit = character()
    ))
  }

  tibble(
    lang       = lang,
    doi        = doi,
    pageid     = map_int(hits, "pageid"),
    page_title = map_chr(hits, "title"),
    url_hit    = map_chr(hits, "url")
  ) |> distinct(pageid, .keep_all = TRUE)
}

run_exturlusage <- function(dois, lang = "en", out_path,
                            log_every = 50, resume = TRUE) {
  dir_create(dirname(out_path))

  done <- character()
  if (resume && file_exists(out_path)) {
    prev <- read_parquet(out_path)
    done <- unique(prev$doi_query)
    cli_alert_info("Resuming: {length(done)} DOIs already queried")
  } else {
    prev <- tibble(
      lang = character(), doi_query = character(), doi = character(),
      pageid = integer(), page_title = character(), url_hit = character(),
      n_hits = integer()
    )
  }

  todo <- setdiff(dois, done)
  cli_alert_info("To query on {lang}: {length(todo)} DOIs")

  if (length(todo) == 0) return(invisible(prev))

  start <- Sys.time()
  results <- prev
  buffer <- list()
  flush_every <- 100

  for (i in seq_along(todo)) {
    doi <- todo[i]

    res <- tryCatch(
      exturl_for_doi(lang, doi),
      error = function(e) {
        cli_alert_warning("Failed for {doi}: {conditionMessage(e)}")
        tibble()
      }
    )

    row <- if (nrow(res) > 0) {
      mutate(res, doi_query = doi, n_hits = nrow(res)) |>
        select(lang, doi_query, doi, pageid, page_title, url_hit, n_hits)
    } else {
      tibble(lang = lang, doi_query = doi, doi = doi,
             pageid = NA_integer_, page_title = NA_character_,
             url_hit = NA_character_, n_hits = 0L)
    }
    buffer[[length(buffer) + 1]] <- row

    if (i %% log_every == 0 || i == length(todo)) {
      elapsed <- as.numeric(difftime(Sys.time(), start, units = "mins"))
      rate    <- i / max(elapsed, 0.01)
      eta_min <- (length(todo) - i) / max(rate, 0.01)
      cli_alert_info("[{i}/{length(todo)}] {round(rate, 1)} DOIs/min, ETA {round(eta_min, 1)} min")
    }

    if (i %% flush_every == 0 || i == length(todo)) {
      results <- bind_rows(results, bind_rows(buffer))
      write_parquet(results, out_path)
      buffer <- list()
    }
  }

  invisible(results)
}
