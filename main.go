package main

import (
	"crypto/rand"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

var addr, db string

var signKey []byte
var allowEmails = []string{"@qq.com", "@zz.ac"}
var allowOrigins = []string{"localhost", ".zz.ac"}
var allowAgents = []string{"obsidian"}

var maxDomainNum int = 20
var maxImageSize int = 2 << 20 /* 2M */
var tempImageTTL int = 20 * 60

var web http.FileSystem

func init() {
	flag.StringVar(&addr, "addr", ":8080", "listen address")
	flag.StringVar(&db, "db", "picr.db", "sqlite db path")

	flag.Parse()

	b := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		panic(err)
	}
	signKey = b[:]

	if s := os.Getenv("PICR_ALLOW_EMAILS"); s != "" {
		allowEmails = append(allowEmails, strings.Split(s, ",")...)
	}

	if s := os.Getenv("PICR_ALLOW_ORIGINS"); s != "" {
		allowOrigins = append(allowOrigins, strings.Split(s, ",")...)
	}

	if s := os.Getenv("PICR_ALLOW_AGENTS"); s != "" {
		allowAgents = append(allowOrigins, strings.Split(s, ",")...)
	}

	for _, x := range []struct {
		name string
		ptr  *int
	}{
		{name: "PICR_MAX_DOMAIN_NUM", ptr: &maxDomainNum},
		{name: "PICR_MAX_IMAGE_SIZE", ptr: &maxImageSize},
		{name: "PICR_TEMP_IMAGE_TTL", ptr: &tempImageTTL},
	} {
		if v := os.Getenv(x.name); v != "" {
			i, err := strconv.Atoi(v)
			if err != nil {
				panic(err)
			}

			*x.ptr = i
		}
	}
}

func main() {
	repo := NewImageRepo(db)

	picr := Picr{
		signKey: signKey,
		repo:    repo,
	}

	mux := http.NewServeMux()

	mux.HandleFunc("POST /{$}", picr.Upload)
	mux.HandleFunc("OPTIONS /{$}", picr.Options)
	mux.HandleFunc("GET /{hash}", picr.Get)
	mux.HandleFunc("GET /list", picr.List)
	mux.HandleFunc("DELETE /{hash}", picr.Del)
	mux.HandleFunc("GET /voyage", picr.Voyage)

	mux.HandleFunc("GET /img/{hash}", picr.Img)
	mux.HandleFunc("POST /token", picr.TokenLink)
	mux.HandleFunc("GET /token", picr.TokenUser)
	mux.HandleFunc("POST /domain", picr.Domain)
	mux.HandleFunc("GET /me", picr.Me)
	mux.HandleFunc("POST /flag", picr.Flag)

	fs := http.FileServer(web)

	mux.Handle("GET /{$}", fs)
	mux.Handle("/web/", http.StripPrefix("/web/", fs))

	http.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
		useProxy := false

		if addr := req.Header.Get("x-real-addr"); addr != "" {
			useProxy = true
			req.RemoteAddr = addr
		}

		if scheme := req.Header.Get("x-real-scheme"); scheme != "" {
			req.URL.Scheme = scheme
		} else {
			req.URL.Scheme = "http"
		}

		if useProxy {
			if req := picr.auth(w, req); req != nil {
				mux.ServeHTTP(w, req)
			}
			return
		}

		start := time.Now()
		lrw := &logResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		defer func() {
			uid, _ := req.Context().Value(UID).(int)
			fmt.Printf(
				"%s - %d [%s] \"%s %s %s\" %d %d \"%s\" \"%s\"\n",
				req.RemoteAddr,
				uid,
				start.Format("02/Jan/2006:15:04:05 -0700"),
				req.Method,
				req.URL.Path,
				req.Proto,
				lrw.statusCode,
				lrw.bytesWritten,
				req.Referer(),
				req.UserAgent(),
			)
		}()

		if req := picr.auth(lrw, req); req != nil {
			mux.ServeHTTP(lrw, req)
		}
	})

	go func() {
		for {
			time.Sleep(1 * time.Minute)
			repo.CleanBefore(time.Now())
		}
	}()

	http.ListenAndServe(addr, nil)
}
