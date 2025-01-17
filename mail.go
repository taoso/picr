package main

import (
	"bytes"
	"os"

	"github.com/emersion/go-sasl"
	"github.com/emersion/go-smtp"
	"github.com/jhillyerd/enmime"
)

type TLSSender struct {
	Username string
	Password string
	Hostaddr string
}

func (s TLSSender) Send(reversePath string, recipients []string, msg []byte) error {
	auth := sasl.NewPlainClient("", s.Username, s.Password)
	return smtp.SendMailTLS(s.Hostaddr, auth, reversePath, recipients, bytes.NewReader(msg))
}

func mail(email, subject, content string) error {
	m := enmime.Builder().
		From("picr.zz.ac", os.Getenv("PICR_SMTP_USER")).
		To("", email).
		Subject(subject).
		Text([]byte(content))

	s := TLSSender{
		Username: os.Getenv("PICR_SMTP_USER"),
		Password: os.Getenv("PICR_SMTP_PASS"),
		Hostaddr: os.Getenv("PICR_SMTP_HOST"),
	}

	return m.Send(s)
}
