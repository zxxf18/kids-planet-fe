# kids-planet-fe

童声星球前端，基于 React、Vinext 和 Vite，提供响应式儿歌列表、搜索、音视频播放、歌词查看以及顺序、随机和循环播放模式。

媒体文件不属于本仓库。音频、视频、歌词和歌曲封面均由 `kids-planet-be` 的 `/api` 接口提供。

## 本地开发

```bash
npm ci
API_PROXY_TARGET=http://127.0.0.1:8888 npm run dev
```

打开 `http://localhost:3000`。

## 验证

```bash
npm run lint
npm run build
```

## 镜像

```bash
docker build -t kids-planet-fe .
docker run --rm -p 3000:3000 kids-planet-fe
```

浏览器请求使用同源 `/api`。生产部署时应由网关或反向代理把 `/api/*` 转发到 `kids-planet-be`，其余请求转发到本前端容器。

## License

GNU Affero General Public License v3.0，详见 `LICENSE`。
