# Picr.zz.ac 匹克图床

![picr](./web/picr.jpg)

轻量级图床服务。在线体验 [Picr.zz.ac](https://picr.zz.ac)

# 安装

## 源码安装

```bash
https://github.com/taoso/picr.git
cd picr
go generate ./...
go build -tags prod
```

本地调试不要指定`-tags`参数，方便实时更改 web 内容。

## Docker

TODO

# 运行

## 命令参数

```
Usage of picr:
  -addr string
        listen address (default ":8080")
  -db string
        sqlite db path (default "picr.db")
```

默认监听`:8080`，数据库默认路径为`./picr.db`，首次运行会自动生成相关数据表。

## 环境变量

邮箱验证功能需要配置以下环境变量。不指定则只允许游客上传。

- `PICR_SMTP_HOST` 邮箱服务器地址，比如 `m1.qq.com:465`
- `PICR_SMTP_USER` 邮箱服务用户名
- `PICR_SMTP_PASS` 邮箱服务密码

以下是可选环境变量，可以按需指定。

- `PICR_ALLOW_EMAILS` 支持的验证邮箱后缀，默认为 `@qq.com,@zz.ac`
- `PICR_ALLOW_AGENTS` 允许的 User-Agent 关键词列表，默认为 `obsidian`[^agent]
- `PICR_ALLOW_ORIGINS` 允许的外链域名后缀列表，默认为 `localhost,zz.ac`
- `PICR_MAX_DOMAIN_NUM` 外链域名数量上限，默认为 20 个
- `PICR_MAX_IMAGE_SIZE` 图片内容上限，单位字节，默认为 2M 字节
- `PICR_TEMP_IMAGE_TTL` 游客图片过期时间，单位是秒，默认为 20 分钟[^ttl]


[^agent]: 设成 Mozilla 则会允许所有浏览器，不过仅限 Referer 为空的情形
[^ttl]: 设为零表示永不过期

## systemd

以下 service 文件要求 picr 程序和数据文件都放在`/var/www/picr`目录。因为 sqlite
需要在该目录创建临时文件，所以该目录需要对运行用户开放写权限。

```ini
[Unit]
Description=Picr.zz.ac
After=network.target

[Service]
WorkingDirectory=/var/www/picr
EnvironmentFile=/var/www/picr/env
ExecStart=/var/www/picr/picr
User=www-data
Group=www-data
KillMode=process
Restart=always

[Install]
WantedBy=multi-user.target
```

## HTTP 代理

Picr 不处理 HTTPS 等逻辑，需要配置 HTTP 代理使用。

使用 Nginx 代理可添加如下配置，并开启访问日志。

```nginx
location / {
    access_log /var/log/nginx/picr.access.log combined;

    proxy_pass http://localhost:8080;

    proxy_set_header Host $host;
    proxy_set_header X-Real-Scheme $scheme;
    proxy_set_header X-Real-Addr $remote_addr:$remote_port;
}
```

# 共享共建

代码依据 MIT 授权开源，大家随便用。支持商业定制。

如果想学习或者参与项目维护，欢迎提交 issue 或者 PR。
