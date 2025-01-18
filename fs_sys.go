//go:build !prod

package main

import "net/http"

func init() {
	web = http.Dir("web")
}
