#!/bin/bash
export PATH="/Users/jeffreybonilla/.fnm/node-versions/v24.14.0/installation/bin:$PATH"
cd /tmp/ritualsong-app
exec node node_modules/next/dist/bin/next dev
