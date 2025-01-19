package main

import (
	"database/sql"
	"math"
	"testing"
	"time"
)

func TestUser(t *testing.T) {
	r := NewImageRepo(":memory:")

	u, err := r.NewUser("foo@bar.us")
	if err != nil {
		t.Fatal(err)
	}

	if u.Created.IsZero() {
		t.Fatal("invalid created")
	}
	if u.ID == 0 {
		t.Fatal("invalid id")
	}

	u.Domains = "foo.us"
	err = r.SaveUser(u)
	if err != nil {
		t.Fatal(err)
	}

	u2, err := r.FindUser(u.Email)
	if err != nil {
		t.Fatal(err)
	}

	if u2.Domains != "foo.us" {
		t.Fatal("invalid referers", u2.Domains)
	}
}

func TestImage(t *testing.T) {
	r := NewImageRepo(":memory:")

	i := UserImage{
		Hash:    "a",
		UserID:  1,
		UserIP:  "1.1.1.1:1",
		Expires: Epoch{time.Now().Add(1 * time.Hour)},
		Image:   []byte{0x1},
	}

	if err := r.Add(&i); err != nil {
		t.Fatal(err)
	}

	if i.ID == 0 {
		t.Fatal("invalid id")
	}

	i2, err := r.Get("a", true)
	if err != nil {
		t.Fatal(err)
	}

	if i2.ID != i.ID {
		t.Fatal("invalid id")
	}

	i3 := UserImage{
		Hash:    "b",
		UserID:  1,
		UserIP:  "1.1.1.1:1",
		Expires: Epoch{time.Now().Add(1 * time.Hour)},
		Image:   []byte{0x2},
	}

	if err := r.Add(&i3); err != nil {
		t.Fatal(err)
	}

	if rs, err := r.ListByUser(1, math.MaxInt, 1); err != nil {
		t.Fatal(err)
	} else if rs[0].ID != 2 {
		t.Fatal("invalid id", rs[0].ID)
	}

	if rs, err := r.ListByUser(1, 2, 1); err != nil {
		t.Fatal(err)
	} else if rs[0].ID != 1 {
		t.Fatal("invalid id", rs[0].ID)
	}

	if err = r.Del(i2.Hash, 1); err != nil {
		t.Fatal(err)
	}

	if _, err = r.Get("a", true); err != sql.ErrNoRows {
		t.Fatal(err)
	}
}

func TestClean(t *testing.T) {
	r := NewImageRepo(":memory:")

	for _, i := range []UserImage{
		{
			Hash:    "a",
			UserID:  1,
			UserIP:  "1.1.1.1:1",
			Expires: Epoch{time.Now().Add(3 * time.Hour)},
			Image:   []byte{0x1},
		},
		{
			Hash:    "b",
			UserID:  1,
			UserIP:  "2.2.2.2:2",
			Expires: Epoch{time.Now().Add(1 * time.Hour)},
			Image:   []byte{0x1},
		},
	} {
		if err := r.Add(&i); err != nil {
			t.Fatal(err)
		}
	}

	if err := r.CleanBefore(time.Now().Add(2 * time.Hour)); err != nil {
		t.Fatal(err)
	}

	if imgs, err := r.ListByUser(1, 10, 10); err != nil {
		t.Fatal(err)
	} else if len(imgs) == 0 {
		t.Fatal("invalid imgs len")
	} else if imgs[0].ID != 1 {
		t.Fatal(err)
	}
}
