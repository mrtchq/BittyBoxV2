#/bin/bash
pbpaste | json-minify | base64 | xargs -0 printf "https://bitty.box.app/#/data:application/ld+json;charset=utf-8;compress=true;base64,%s" | xargs open