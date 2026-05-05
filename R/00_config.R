suppressPackageStartupMessages({
  library(httr2)
  library(dplyr)
  library(readr)
  library(tidyr)
  library(stringr)
  library(purrr)
  library(jsonlite)
  library(arrow)
  library(fs)
  library(glue)
  library(cli)
})

PROJECT_ROOT <- "/Users/lukaswallrich/Documents/Coding/flora-wikipedia"

DATA_DIR   <- file.path(PROJECT_ROOT, "data")
CACHE_DIR  <- file.path(PROJECT_ROOT, "cache")
OUTPUT_DIR <- file.path(PROJECT_ROOT, "output")
WIKITEXT_DIR <- file.path(CACHE_DIR, "wikitext")

USER_AGENT <- "FReD-Wikipedia-Audit/0.1 (https://github.com/forrtproject/FReD-data; lukas.wallrich@gmail.com)"

LANGS_PRIMARY <- c("en")
LANGS_EXTENDED <- c("en", "de", "fr", "es", "it", "nl", "pt", "ru", "ja", "zh")

DOI_REGEX <- "10\\.[0-9]{4,9}/[^\\s|}\\]<>\"'\\\\]+"

normalise_doi <- function(x) {
  x <- str_trim(x)
  x <- str_to_lower(x)
  x <- str_replace_all(x, "%3c", "<")
  x <- str_replace_all(x, "%3e", ">")
  x <- str_replace(x, "^https?://(dx\\.)?doi\\.org/", "")
  x <- str_replace(x, "^doi:", "")
  x <- str_replace_all(x, "[\\.,;:\\)\\]\\}'\"]+$", "")
  x
}
