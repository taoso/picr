//go:build prod

package main

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed web/*
var webFS embed.FS

func init() {
	fsys, err := fs.Sub(webFS, "web")
	if err != nil {
		panic(err)
	}
	web = http.FS(fsys)
}
