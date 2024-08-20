FROM node:18.19.1-alpine as builder

WORKDIR /usr/src/app

# install node-gyp dependencies
RUN apk add --no-cache python3 make g++

# install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY . /usr/src/app/

# for pnpm to generate a flat node_modules without symlinks
# so that modclean could work as expected
RUN echo "node-linker=hoisted" > .npmrc

RUN pnpm config set auto-install-peers true

# install and build production dependencies,
RUN pnpm install && pnpm run build

EXPOSE 8080

# Start Nocodb
CMD ["node", "./dist/main.js"]
