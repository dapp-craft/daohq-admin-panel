FROM node:21-alpine as build

WORKDIR /app

COPY package*.json ./

RUN NODE_ENV=development npm i

COPY . .

RUN npm run build

FROM nginx:alpine

RUN apk add --no-cache git

COPY ./nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]