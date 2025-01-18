package main

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type ctxKey int

const (
	UID ctxKey = iota
)

type Picr struct {
	signKey []byte
	repo    ImageRepo
}

func (p Picr) auth(w http.ResponseWriter, req *http.Request) *http.Request {
	auth := req.Header.Get("authorization")
	if auth == "" {
		return req
	}

	token := ""
	if len(auth) > 7 {
		token = auth[7:]
	}

	i := strings.Index(token, "~")
	if i == -1 {
		return req
	}

	uid, err := strconv.Atoi(token[:i])
	if err != nil {
		return req
	}
	token = token[i+1:]

	u, err := p.repo.GetUser(uid)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return nil
	}

	if u.Token != token {
		return req
	}

	ctx := req.Context()
	ctx = context.WithValue(ctx, UID, u.ID)

	return req.WithContext(ctx)
}

func (p Picr) TokenLink(w http.ResponseWriter, req *http.Request) {
	email := req.FormValue("e")

	if !strings.HasSuffix(email, "@qq.com") {
		http.Error(w, "当前仅支持QQ邮箱", http.StatusBadRequest)
		return
	}

	h := hmac.New(sha256.New, p.signKey)

	n := time.Now()
	t := n.Unix()
	ts := strconv.Itoa(int(t))

	h.Write([]byte(email + ts))
	s := h.Sum(nil)
	sign := base64.URLEncoding.EncodeToString(s)

	link := fmt.Sprintf("https://%s%s?e=%s&t=%s&s=%s", req.Host, req.URL.Path, email, ts, sign)

	content := "Your Token Link is: \n\n" +
		link + "\n\n" +
		"This link will expire in 5 minutes."

	if err := mail(email, "Picr.zz.ac Token Link", content); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (p Picr) TokenUser(w http.ResponseWriter, req *http.Request) {
	e := req.URL.Query().Get("e")
	t := req.URL.Query().Get("t")
	s := req.URL.Query().Get("s")

	s1, err := base64.URLEncoding.DecodeString(s)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	h := hmac.New(sha256.New, p.signKey)
	h.Write([]byte(e + t))
	s2 := h.Sum(nil)

	if !hmac.Equal(s1, s2) {
		http.Error(w, "invalid signature", http.StatusBadRequest)
		return
	}

	i, err := strconv.Atoi(t)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	tt := time.Unix(int64(i), 0)
	if time.Now().Sub(tt) > 10*time.Minute {
		http.Error(w, "The link has expired", http.StatusBadRequest)
		return
	}

	u, err := p.repo.FindUser(e)

	if errors.Is(err, sql.ErrNoRows) {
		u, err = p.repo.NewUser(e)
	}

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	u.Token = base64.URLEncoding.EncodeToString(b)

	if err := p.repo.SaveUser(u); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write([]byte(fmt.Sprintf("%d~%s", u.ID, u.Token)))
}

func (p Picr) Upload(w http.ResponseWriter, req *http.Request) {
	uid, _ := req.Context().Value(UID).(int)

	err := req.ParseMultipartForm(int64(maxImageSize * 2))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	file, handler, err := req.FormFile("file")
	if err != nil {
		http.Error(w, "Error Retrieving the File", http.StatusBadRequest)
		return
	}
	defer file.Close()

	if int(handler.Size) > maxImageSize {
		http.Error(w, "Image is too big", http.StatusBadRequest)
		return
	}

	data, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	h := sha256.New()
	h.Write(data)

	if uid == 0 {
		h.Write([]byte(time.Now().Format(time.RFC3339Nano)))
	}

	hash := base64.URLEncoding.EncodeToString(h.Sum(nil))

	mime := http.DetectContentType(data)

	if !strings.HasPrefix(mime, "image/") {
		http.Error(w, "invalid image", http.StatusBadRequest)
		return
	}

	addr := req.Header.Get("x-remote-addr")
	if addr == "" {
		addr = req.RemoteAddr
	}

	img := UserImage{
		Hash:   hash,
		Type:   mime,
		UserID: uid,
		UserIP: addr,
		Image:  data,
	}

	if uid == 0 {
		d := time.Duration(tempImageTTL) * time.Second
		img.Expires = Epoch{time.Now().Add(d)}
	}

	if err := p.repo.Add(&img); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("content-type", "application/json")
	json.NewEncoder(w).Encode(img)
}

func (p Picr) Img(w http.ResponseWriter, req *http.Request) {
	h := req.PathValue("hash")

	img, err := p.repo.Get(h, true)
	if errors.Is(err, sql.ErrNoRows) {
		http.Error(w, "Image not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	for i, u := range img.Users {
		if u.UserID > 0 {
			img.Users[i].UserIP = ""
		}
	}

	w.Header().Set("content-type", "application/json")
	json.NewEncoder(w).Encode(img)
}

func (p Picr) Get(w http.ResponseWriter, req *http.Request) {
	h := req.PathValue("hash")
	img, err := p.repo.Get(h, true)
	if errors.Is(err, sql.ErrNoRows) {
		http.Error(w, "Image not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	referer, err := url.Parse(req.Referer())
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	origin := referer.Hostname()

	if origin == "" {
		var proto string
		if req.TLS != nil {
			proto = "https"
		} else {
			proto = "http"
		}
		url := proto + "://" + req.Host + "/#/img/" + h
		http.Redirect(w, req, url, http.StatusFound)
		return
	}

	badReferer := true
	for _, u := range img.Users {
		if u.UserID == 0 {
			badReferer = false
			break
		}

		u, err := p.repo.GetUser(u.UserID)
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "Image not found", http.StatusNotFound)
			return
		} else if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		for _, d := range strings.Fields(u.Domains) {
			if d == origin {
				badReferer = false
				break
			}
		}
	}
	if badReferer {
		svg := `<svg height="50" width="400"
			xmlns="http://www.w3.org/2000/svg">
			<text x="5" y="20" font-family="monospace" fill="red"
			font-size="18">未允许禁止引用匹克图床(PICR.ZZ.AC)内容!</text>
			</svg>`
		w.Header().Set("content-type", "image/svg+xml")
		w.Header().Set("cache-control", "no-store")
		w.Write([]byte(svg))
		return
	}

	w.Header().Set("content-type", img.Type)
	w.Write(img.Data)
}

func (p Picr) Del(w http.ResponseWriter, req *http.Request) {
	uid, ok := req.Context().Value(UID).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
	}

	h := req.PathValue("hash")
	if err := p.repo.Del(h, uid); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

func (p Picr) List(w http.ResponseWriter, req *http.Request) {
	uid, ok := req.Context().Value(UID).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	last := math.MaxInt
	if s := req.URL.Query().Get("l"); s != "" {
		l, err := strconv.Atoi(s)
		if err != nil {
			http.Error(w, "invalid l", http.StatusBadRequest)
			return
		}
		last = l
	}

	imgs, err := p.repo.ListByUser(uid, last, 10)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("content-type", "application/json")

	json.NewEncoder(w).Encode(imgs)
}

func (p Picr) Domain(w http.ResponseWriter, req *http.Request) {
	uid, ok := req.Context().Value(UID).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
	}

	s := req.FormValue("domains")
	domains := strings.Fields(s)
	if len(domains) > 50 {
		http.Error(w, "too many domains", http.StatusBadRequest)
		return
	}

	u, err := p.repo.GetUser(uid)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	u.Domains = s

	if err = p.repo.SaveUser(u); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (p Picr) Me(w http.ResponseWriter, req *http.Request) {
	uid, ok := req.Context().Value(UID).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
	}

	u, err := p.repo.GetUser(uid)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("content-type", "application/json")
	json.NewEncoder(w).Encode(u)
	return
}

type logResponseWriter struct {
	http.ResponseWriter
	bytesWritten int
	statusCode   int
}

func (w *logResponseWriter) Write(b []byte) (int, error) {
	n, err := w.ResponseWriter.Write(b)
	w.bytesWritten += n
	return n, err
}

func (w *logResponseWriter) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}
