package main

import (
	"encoding/base64"
	"flag"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"
)

var addr, db string

var signKey []byte

var maxDomainNum int = 20
var maxImageSize int = 1 << 20 /* 1M */
var tempImageTTL int = 20 * 60

func init() {
	flag.StringVar(&addr, "addr", ":8080", "listen address")
	flag.StringVar(&db, "db", "picr.db", "sqlite db path")

	var err error

	signKey, err = base64.StdEncoding.DecodeString(os.Getenv("SIGN_KEY"))
	if err != nil {
		panic(err)
	}

	for _, x := range []struct {
		name string
		ptr  *int
	}{
		{name: "MAX_DOMAIN_NUM", ptr: &maxDomainNum},
		{name: "MAX_IMAGE_SIZE", ptr: &maxImageSize},
		{name: "TEMP_IMAGE_TTL", ptr: &tempImageTTL},
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

	mux.HandleFunc("GET /{$}", picr.Upload)
	mux.HandleFunc("POST /{$}", picr.Upload)
	mux.HandleFunc("GET /{hash}", picr.Get)
	mux.HandleFunc("GET /list", picr.List)
	mux.HandleFunc("DELETE /{hash}", picr.Del)

	mux.HandleFunc("POST /token", picr.TokenLink)
	mux.HandleFunc("GET /token", picr.TokenUser)
	mux.HandleFunc("POST /domain", picr.Domain)

	http.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
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
