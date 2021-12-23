#!/bin/bash

cd layer

rm -rf build
rm -rf dist && mkdir dist

rm -rf build
mkdir -p build/nodejs
cp package.json build/nodejs/package.json

cd build/nodejs && npm run init:x64
cd .. && zip -r layer.zip . && mv layer.zip ../dist/layer-x64.zip && cd ..

rm -rf build
mkdir -p build/nodejs
cp package.json build/nodejs/package.json

cd build/nodejs && npm run init:arm64
cd .. && zip -r layer.zip . && mv layer.zip ../dist/layer-arm64.zip && cd ..

