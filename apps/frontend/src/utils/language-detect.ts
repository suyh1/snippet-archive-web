const MARKDOWN_LINE_RE = /^(#{1,6}\s+.+|>\s+.+|[-*+]\s+.+|\d+\.\s+.+)/
const TS_TYPE_ANNOTATION_RE =
  /(?:const|let|var|function)\s+[A-Za-z_$][\w$]*\s*:\s*[A-Za-z_$][\w$<>,\s\[\]\|\?&]*/

export function normalizeLanguage(language: string) {
  if (language === 'typescript') {
    return 'typescript'
  }
  if (language === 'javascript') {
    return 'javascript'
  }
  if (language === 'json') {
    return 'json'
  }
  if (language === 'markdown') {
    return 'markdown'
  }
  if (language === 'html') {
    return 'html'
  }
  if (language === 'vue') {
    return 'vue'
  }
  return 'plaintext'
}

function looksLikeJson(snippet: string) {
  if (
    !(snippet.startsWith('{') && snippet.endsWith('}')) &&
    !(snippet.startsWith('[') && snippet.endsWith(']'))
  ) {
    return false
  }

  try {
    JSON.parse(snippet)
    return true
  } catch {
    return false
  }
}

function looksLikeMarkdown(snippet: string) {
  const lines = snippet.split('\n').map((line) => line.trim()).filter(Boolean)
  if (snippet.includes('```')) {
    return true
  }

  return lines.some((line) => MARKDOWN_LINE_RE.test(line))
}

export function detectLanguageFromSnippet(rawSnippet: string) {
  const snippet = rawSnippet.trim()
  if (!snippet) {
    return null
  }

  if (/^<template[\s>]|<script[\s>]|<style[\s>]/im.test(snippet)) {
    return 'vue'
  }

  if (looksLikeJson(snippet)) {
    return 'json'
  }

  if (/^<!doctype html>/i.test(snippet) || /<\/?[a-z][\w:-]*\b[^>]*>/i.test(snippet)) {
    return 'html'
  }

  if (looksLikeMarkdown(snippet)) {
    return 'markdown'
  }

  if (/\binterface\s+[A-Za-z_$]/.test(snippet) || /\btype\s+[A-Za-z_$]/.test(snippet)) {
    return 'typescript'
  }

  if (/\bimport\s+type\b/.test(snippet) || TS_TYPE_ANNOTATION_RE.test(snippet)) {
    return 'typescript'
  }

  if (/\b(const|let|var|function|class|export|import)\b/.test(snippet)) {
    return 'javascript'
  }

  return null
}

