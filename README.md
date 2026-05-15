# 拼豆冒险屋

一个基于 `Vue 3 + TypeScript + Vite` 的拼豆闯关网页游戏。

## 本地开发

```bash
npm install
npm run dev
```

## 生产构建

```bash
npm run build
```

## Docker 镜像

构建镜像：

```bash
docker build -t pingdou-game:latest .
```

运行容器：

```bash
docker run -d --name pingdou-game -p 8080:80 pingdou-game:latest
```

访问地址：

```text
http://<你的服务器IP>:8080
```
