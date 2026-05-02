#!/usr/bin/bash

target="/mnt/seagate/obsidian-vaults/central/.obsidian/plugins/glyphure"

# compila o js e copia os arquivos necessários pro plugin funcionar
npm run build

# rm -rf $target
mkdir -p $target

cp manifest.json main.js styles.css $target