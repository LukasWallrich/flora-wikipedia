source("/Users/lukaswallrich/Documents/Coding/flora-wikipedia/R/02_exturlusage.R")

wikitext_path <- function(lang, pageid) {
  d <- file.path(WIKITEXT_DIR, lang)
  dir_create(d)
  file.path(d, paste0(pageid, ".txt"))
}

fetch_wikitext_one <- function(lang, pageid) {
  resp <- mw_request(lang) |>
    req_url_query(
      action  = "query",
      prop    = "revisions",
      rvprop  = "content|ids",
      rvslots = "main",
      pageids = as.character(pageid),
      format  = "json",
      maxlag  = "5"
    ) |>
    req_perform()

  body <- resp_body_json(resp)
  page <- body$query$pages[[1]]

  if (!is.null(page$missing) || is.null(page$revisions)) {
    return(list(title = NA_character_, revid = NA_integer_, content = NA_character_))
  }

  rev <- page$revisions[[1]]
  list(
    title   = page$title %||% NA_character_,
    revid   = rev$revid %||% NA_integer_,
    content = rev$slots$main$`*` %||% rev$slots$main$content %||% NA_character_
  )
}

fetch_all_wikitext <- function(hits, log_every = 25) {
  to_fetch <- hits |>
    filter(!is.na(pageid)) |>
    distinct(lang, pageid) |>
    arrange(lang, pageid)

  needed <- to_fetch |>
    mutate(path = map2_chr(lang, pageid, wikitext_path)) |>
    filter(!file_exists(path))

  cli_alert_info("Need to fetch {nrow(needed)} of {nrow(to_fetch)} candidate pages (rest cached)")
  if (nrow(needed) == 0) return(invisible(NULL))

  meta_path <- file.path(DATA_DIR, "wikitext_meta.parquet")
  meta_existing <- if (file_exists(meta_path)) read_parquet(meta_path) else
    tibble(lang = character(), pageid = integer(), title = character(), revid = integer())

  meta_buffer <- list()
  for (i in seq_len(nrow(needed))) {
    row <- needed[i, ]
    res <- tryCatch(
      fetch_wikitext_one(row$lang, row$pageid),
      error = function(e) {
        cli_alert_warning("Failed page {row$pageid}@{row$lang}: {conditionMessage(e)}")
        list(title = NA_character_, revid = NA_integer_, content = NA_character_)
      }
    )

    if (!is.na(res$content)) {
      writeLines(res$content, row$path, useBytes = TRUE)
    }
    meta_buffer[[length(meta_buffer) + 1]] <- tibble(
      lang = row$lang, pageid = as.integer(row$pageid),
      title = res$title, revid = as.integer(res$revid %||% NA)
    )

    if (i %% log_every == 0 || i == nrow(needed)) {
      cli_alert_info("[{i}/{nrow(needed)}] wikitext fetched")
      meta_existing <- bind_rows(meta_existing, bind_rows(meta_buffer)) |>
        distinct(lang, pageid, .keep_all = TRUE)
      write_parquet(meta_existing, meta_path)
      meta_buffer <- list()
    }
  }

  invisible(meta_existing)
}
