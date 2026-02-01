# 使用 Node.js 官方镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装 Python 和构建工具 (better-sqlite3 需要)
RUN apk add --no-cache python3 make g++

# 复制 package.json
COPY package.json ./

# 安装依赖
RUN npm install --production

# 复制项目文件
COPY server.js ./
COPY public ./public

# 创建数据目录
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 启动服务
CMD ["node", "server.js"]
