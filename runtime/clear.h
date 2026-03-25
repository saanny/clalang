// clalang — C Runtime Header
#ifndef CLEAR_H
#define CLEAR_H

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include <math.h>
#include <stdarg.h>
#include <pthread.h>

// ── String Utilities ───────────────────────────────────────

static inline int32_t clear_str_len(const char* s) {
  return (int32_t)strlen(s);
}

static inline bool clear_str_eq(const char* a, const char* b) {
  return strcmp(a, b) == 0;
}

static inline const char* clear_str_concat(const char* a, const char* b) {
  size_t la = strlen(a), lb = strlen(b);
  char* r = (char*)malloc(la + lb + 1);
  memcpy(r, a, la);
  memcpy(r + la, b, lb + 1);
  return r;
}

static inline bool clear_str_contains(const char* haystack, const char* needle) {
  return strstr(haystack, needle) != NULL;
}

static inline const char* clear_str_substr(const char* s, int32_t start, int32_t len) {
  size_t slen = strlen(s);
  if (start < 0 || start >= (int32_t)slen) return "";
  if (start + len > (int32_t)slen) len = (int32_t)slen - start;
  char* r = (char*)malloc(len + 1);
  memcpy(r, s + start, len);
  r[len] = '\0';
  return r;
}

static inline const char* clear_int_to_str(int64_t n) {
  char* buf = (char*)malloc(32);
  snprintf(buf, 32, "%ld", (long)n);
  return buf;
}

static inline const char* clear_float_to_str(double n) {
  char* buf = (char*)malloc(64);
  snprintf(buf, 64, "%g", n);
  return buf;
}

// ── Dynamic Array (i32) ───────────────────────────────────

typedef struct {
  int32_t* data;
  int32_t len;
  int32_t cap;
} ClearArray_i32;

static inline ClearArray_i32 clear_array_new_i32(void) {
  return (ClearArray_i32){ .data = NULL, .len = 0, .cap = 0 };
}

static inline void clear_array_push_i32(ClearArray_i32* a, int32_t val) {
  if (a->len >= a->cap) {
    a->cap = a->cap ? a->cap * 2 : 4;
    a->data = (int32_t*)realloc(a->data, a->cap * sizeof(int32_t));
  }
  a->data[a->len++] = val;
}

static inline ClearArray_i32 clear_array_from_i32(int count, ...) {
  ClearArray_i32 a = clear_array_new_i32();
  va_list args;
  va_start(args, count);
  for (int i = 0; i < count; i++) clear_array_push_i32(&a, va_arg(args, int));
  va_end(args);
  return a;
}

static inline ClearArray_i32 clear_array_map_i32(ClearArray_i32 a, int32_t (*fn)(int32_t)) {
  ClearArray_i32 r = clear_array_new_i32();
  for (int32_t i = 0; i < a.len; i++) clear_array_push_i32(&r, fn(a.data[i]));
  return r;
}

static inline ClearArray_i32 clear_array_filter_i32(ClearArray_i32 a, bool (*fn)(int32_t)) {
  ClearArray_i32 r = clear_array_new_i32();
  for (int32_t i = 0; i < a.len; i++) if (fn(a.data[i])) clear_array_push_i32(&r, a.data[i]);
  return r;
}

static inline int32_t clear_array_sum_i32(ClearArray_i32 a) {
  int32_t s = 0;
  for (int32_t i = 0; i < a.len; i++) s += a.data[i];
  return s;
}

static inline int32_t clear_array_len_i32(ClearArray_i32 a) {
  return a.len;
}

static inline void clear_array_free_i32(ClearArray_i32* a) {
  free(a->data);
  a->data = NULL;
  a->len = a->cap = 0;
}

// ── Dynamic Array (f64) ───────────────────────────────────

typedef struct {
  double* data;
  int32_t len;
  int32_t cap;
} ClearArray_f64;

static inline ClearArray_f64 clear_array_new_f64(void) {
  return (ClearArray_f64){ .data = NULL, .len = 0, .cap = 0 };
}

static inline void clear_array_push_f64(ClearArray_f64* a, double val) {
  if (a->len >= a->cap) {
    a->cap = a->cap ? a->cap * 2 : 4;
    a->data = (double*)realloc(a->data, a->cap * sizeof(double));
  }
  a->data[a->len++] = val;
}

static inline ClearArray_f64 clear_array_from_f64(int count, ...) {
  ClearArray_f64 a = clear_array_new_f64();
  va_list args;
  va_start(args, count);
  for (int i = 0; i < count; i++) clear_array_push_f64(&a, va_arg(args, double));
  va_end(args);
  return a;
}

static inline ClearArray_f64 clear_array_map_f64(ClearArray_f64 a, double (*fn)(double)) {
  ClearArray_f64 r = clear_array_new_f64();
  for (int32_t i = 0; i < a.len; i++) clear_array_push_f64(&r, fn(a.data[i]));
  return r;
}

static inline double clear_array_sum_f64(ClearArray_f64 a) {
  double s = 0;
  for (int32_t i = 0; i < a.len; i++) s += a.data[i];
  return s;
}

// ── Channel ───────────────────────────────────────────────

typedef struct {
  pthread_mutex_t mutex;
  pthread_cond_t  cond;
  int64_t         value;
  bool            ready;
} ClearChannel;

static inline ClearChannel* clear_channel_new(void) {
  ClearChannel* ch = (ClearChannel*)malloc(sizeof(ClearChannel));
  pthread_mutex_init(&ch->mutex, NULL);
  pthread_cond_init(&ch->cond, NULL);
  ch->ready = false;
  return ch;
}

static inline void clear_channel_send(ClearChannel* ch, int64_t value) {
  pthread_mutex_lock(&ch->mutex);
  while (ch->ready) pthread_cond_wait(&ch->cond, &ch->mutex);
  ch->value = value;
  ch->ready = true;
  pthread_cond_signal(&ch->cond);
  pthread_mutex_unlock(&ch->mutex);
}

static inline int64_t clear_channel_recv(ClearChannel* ch) {
  pthread_mutex_lock(&ch->mutex);
  while (!ch->ready) pthread_cond_wait(&ch->cond, &ch->mutex);
  int64_t v = ch->value;
  ch->ready = false;
  pthread_cond_signal(&ch->cond);
  pthread_mutex_unlock(&ch->mutex);
  return v;
}

static inline void clear_channel_free(ClearChannel* ch) {
  pthread_mutex_destroy(&ch->mutex);
  pthread_cond_destroy(&ch->cond);
  free(ch);
}

// ── Thread Spawn ──────────────────────────────────────────

static inline pthread_t clear_spawn(void* (*fn)(void*), void* ctx) {
  pthread_t t;
  pthread_create(&t, NULL, fn, ctx);
  pthread_detach(t);
  return t;
}

// ── File I/O ──────────────────────────────────────────────

static inline const char* clear_fs_read(const char* path) {
  FILE* f = fopen(path, "rb");
  if (!f) return "";
  fseek(f, 0, SEEK_END);
  long len = ftell(f);
  fseek(f, 0, SEEK_SET);
  char* buf = (char*)malloc(len + 1);
  fread(buf, 1, len, f);
  buf[len] = '\0';
  fclose(f);
  return buf;
}

static inline bool clear_fs_write(const char* path, const char* content) {
  FILE* f = fopen(path, "wb");
  if (!f) return false;
  fputs(content, f);
  fclose(f);
  return true;
}

// ── CLI Arguments ─────────────────────────────────────────

static int _clear_argc = 0;
static char** _clear_argv = NULL;

static inline int32_t clear_args_count(void) { return _clear_argc; }

static inline const char* clear_arg(int32_t n) {
  if (n < 0 || n >= _clear_argc) return "";
  return _clear_argv[n];
}

static inline const char* clear_args_join(int32_t from) {
  if (from >= _clear_argc) return "";
  size_t total = 0;
  for (int i = from; i < _clear_argc; i++) total += strlen(_clear_argv[i]) + 1;
  char* buf = (char*)malloc(total);
  buf[0] = '\0';
  for (int i = from; i < _clear_argc; i++) {
    if (i > from) strcat(buf, " ");
    strcat(buf, _clear_argv[i]);
  }
  return buf;
}

// ── Extra String Utilities ────────────────────────────────

static inline bool clear_str_starts_with(const char* s, const char* prefix) {
  return strncmp(s, prefix, strlen(prefix)) == 0;
}

static inline int32_t clear_str_to_int(const char* s) {
  return (int32_t)atoi(s);
}

static inline int32_t clear_str_count_lines(const char* s) {
  if (!s || !*s) return 0;
  int32_t count = 0;
  for (; *s; s++) if (*s == '\n') count++;
  // Count last line if it doesn't end with \n
  if (s[-1] != '\n') count++;
  return count;
}

static inline const char* clear_str_get_line(const char* s, int32_t n) {
  int32_t cur = 0;
  const char* start = s;
  while (*s) {
    if (*s == '\n') {
      if (cur == n) {
        size_t len = s - start;
        char* line = (char*)malloc(len + 1);
        memcpy(line, start, len);
        line[len] = '\0';
        return line;
      }
      cur++;
      start = s + 1;
    }
    s++;
  }
  if (cur == n && *start) {
    return strdup(start);
  }
  return "";
}

static inline const char* clear_str_set_line(const char* s, int32_t n, const char* newline) {
  size_t slen = strlen(s);
  size_t nlen = strlen(newline);
  char* result = (char*)malloc(slen + nlen + 2);
  char* dst = result;
  const char* src = s;
  int32_t cur = 0;
  while (*src) {
    if (cur == n) {
      memcpy(dst, newline, nlen); dst += nlen;
      *dst++ = '\n';
      while (*src && *src != '\n') src++;
      if (*src == '\n') src++;
      cur++;
    } else {
      while (*src && *src != '\n') *dst++ = *src++;
      if (*src == '\n') { *dst++ = *src++; }
      cur++;
    }
  }
  *dst = '\0';
  return result;
}

static inline const char* clear_str_delete_line(const char* s, int32_t n) {
  size_t slen = strlen(s);
  char* result = (char*)malloc(slen + 1);
  char* dst = result;
  const char* src = s;
  int32_t cur = 0;
  while (*src) {
    if (cur == n) {
      while (*src && *src != '\n') src++;
      if (*src == '\n') src++;
      cur++;
    } else {
      while (*src && *src != '\n') *dst++ = *src++;
      if (*src == '\n') { *dst++ = *src++; }
      cur++;
    }
  }
  *dst = '\0';
  return result;
}

static inline const char* clear_str_replace(const char* s, const char* old, const char* neww) {
  const char* pos = strstr(s, old);
  if (!pos) return strdup(s);
  size_t before = pos - s;
  size_t olen = strlen(old);
  size_t nlen = strlen(neww);
  size_t slen = strlen(s);
  char* result = (char*)malloc(slen - olen + nlen + 1);
  memcpy(result, s, before);
  memcpy(result + before, neww, nlen);
  strcpy(result + before + nlen, pos + olen);
  return result;
}

static inline bool clear_fs_exists(const char* path) {
  FILE* f = fopen(path, "r");
  if (!f) return false;
  fclose(f);
  return true;
}

#endif // CLEAR_H
