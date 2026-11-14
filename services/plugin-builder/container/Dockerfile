ARG BUILDER_NODE_IMAGE=node:24-bookworm-slim
FROM ${BUILDER_NODE_IMAGE}
WORKDIR /builder
RUN npm init -y && npm install --save-exact --ignore-scripts esbuild@0.28.2 react@19.3.1 react-dom@19.3.1 zod@3.25.76
COPY sdk.tsx ./sdk.tsx
COPY build.mjs ./build.mjs
USER 65534:65534
ENTRYPOINT ["node", "/builder/build.mjs"]
