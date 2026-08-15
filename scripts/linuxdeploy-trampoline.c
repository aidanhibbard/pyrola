#include <string.h>
#include <stdlib.h>
#include <unistd.h>

#ifndef REAL_PATH
#error REAL_PATH must be defined
#endif

int main(int argc, char **argv) {
  char *next[argc + 1];
  int n = 0;
  next[n++] = (char *)REAL_PATH;
  for (int i = 1; i < argc; i++) {
    if (strcmp(argv[i], "--appimage-extract-and-run") == 0) {
      continue;
    }
    next[n++] = argv[i];
  }
  next[n] = NULL;
  setenv("APPIMAGE_EXTRACT_AND_RUN", "1", 1);
  execv(REAL_PATH, next);
  return 127;
}
