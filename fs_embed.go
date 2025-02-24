//go:build prod

package main

import (
	"debug/buildinfo"
	"embed"
	"io/fs"
	"net/http"
	"os"
	"time"
)

//go:embed web/*
var webFS embed.FS

var buildTime time.Time

func init() {
	exe, err := os.Executable()
	if err != nil {
		panic(err)
	}

	info, err := buildinfo.ReadFile(exe)
	if err != nil {
		panic(err)
	}

	for _, s := range info.Settings {
		if s.Key == "vcs.time" && s.Value != "" {
			t, err := time.Parse(time.RFC3339, s.Value)
			if err != nil {
				panic(err)
			}
			buildTime = t
			break
		}
	}
}

type embedFS struct {
	fs.FS
	modTime time.Time
}

func (f *embedFS) Open(name string) (fs.File, error) {
	file, err := f.FS.Open(name)

	return &embedFile{File: file, modTime: f.modTime}, err
}

type embedFile struct {
	fs.File
	modTime time.Time
}

func (f *embedFile) Stat() (os.FileInfo, error) {
	fileInfo, err := f.File.Stat()

	return &embedFileInfo{FileInfo: fileInfo, modTime: f.modTime}, err
}

type embedFileInfo struct {
	os.FileInfo
	modTime time.Time
}

func (f *embedFileInfo) ModTime() time.Time {
	return f.modTime
}

func init() {
	fsys, err := fs.Sub(webFS, "web")
	if err != nil {
		panic(err)
	}
	web = http.FS(&embedFS{
		FS:      fsys,
		modTime: buildTime,
	})
}
