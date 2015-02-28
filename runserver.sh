#! /bin/bash

sudo PORT=80 forever start -o stdout.log -e stderr.log server.js
