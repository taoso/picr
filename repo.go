package main

import (
	"database/sql/driver"
	"fmt"
	"time"

	"github.com/go-kiss/sqlx"
	_ "modernc.org/sqlite"
)

type Epoch struct {
	time.Time
}

func (t *Epoch) Scan(val any) (err error) {
	switch v := val.(type) {
	case int64:
		*t = Epoch{time.Unix(v, 0)}
		return nil
	default:
		return fmt.Errorf("Time.Scan: Unsupported type: %T", v)
	}
}

func (t Epoch) Value() (driver.Value, error) {
	return t.Unix(), nil
}

type User struct {
	ID       int    `db:"id" json:"id"`
	Email    string `db:"email" json:"email"`
	Token    string `db:"token" json:"token"`
	Referers string `db:"referers" json:"referers"`
	Created  Epoch  `db:"created" json:"created"`
}

func (_ *User) KeyName() string   { return "id" }
func (_ *User) TableName() string { return "users" }
func (t *User) Schema() string {
	return "CREATE TABLE IF NOT EXISTS " + t.TableName() + `(
	` + t.KeyName() + ` INTEGER PRIMARY KEY AUTOINCREMENT,
	email TEXT,
	token TEXT,
	referers TEXT,
	created INTEGER
);
	CREATE UNIQUE INDEX IF NOT EXISTS udx_email ON ` + t.TableName() + `(email);`
}

type Image struct {
	ID      int    `db:"id" json:"id"`
	Hash    string `db:"hash" json:"hash"`
	Type    string `db:"type" json:"type"`
	UserID  int    `db:"user_id" json:"-"`
	UserIP  string `db:"user_ip" json:"-"`
	Created Epoch  `db:"created" json:"created"`
	Expires Epoch  `db:"expires" json:"expires"`
	Image   []byte `db:"image" json:"-"`
}

func (_ *Image) KeyName() string   { return "id" }
func (_ *Image) TableName() string { return "images" }
func (t *Image) Schema() string {
	return "CREATE TABLE IF NOT EXISTS " + t.TableName() + `(
	` + t.KeyName() + ` INTEGER PRIMARY KEY AUTOINCREMENT,
	hash TEXT,
	type TEXT,
	user_id INTEGER,
	user_ip TEXT,
	created INTEGER,
	expires INTEGER,
	image blob
);
	CREATE UNIQUE INDEX IF NOT EXISTS udx_hash ON ` + t.TableName() + `(hash);
	CREATE INDEX IF NOT EXISTS idx_user_id ON ` + t.TableName() + `(user_id,id);
	CREATE INDEX IF NOT EXISTS idx_expires ON ` + t.TableName() + `(expires) where expires > 0;`
}

func (r ImageRepo) GetUser(id int) (u User, err error) {
	err = r.rdb.Get(&u, "select * from "+u.TableName()+" where id = ?", id)
	return
}

func (r ImageRepo) FindUser(email string) (u User, err error) {
	err = r.rdb.Get(&u, "select * from "+u.TableName()+" where email = ?", email)
	return
}

func (r ImageRepo) NewUser(email string) (u User, err error) {
	u.Email = email
	u.Created = Epoch{time.Now()}

	re, err := r.db.Insert(&u)
	if err != nil {
		return
	}

	id, err := re.LastInsertId()
	if err != nil {
		return
	}

	u.ID = int(id)
	return
}

func (r ImageRepo) SaveUser(u User) (err error) {
	_, err = r.db.Update(&u)
	return
}

type ImageRepo struct {
	db  *sqlx.DB
	rdb *sqlx.DB
}

func (r ImageRepo) Init() {
	if _, err := r.db.Exec((*User).Schema(nil)); err != nil {
		panic(err)
	}
	if _, err := r.db.Exec((*Image).Schema(nil)); err != nil {
		panic(err)
	}
}

func NewImageRepo(path string) ImageRepo {
	db, err := sqlx.Connect("sqlite", path)
	if err != nil {
		panic(err)
	}
	db.SetMaxOpenConns(1)

	rdb, err := sqlx.Connect("sqlite", path)
	if err != nil {
		panic(err)
	}

	if path == ":memory:" {
		rdb = db
	}

	for _, db := range []*sqlx.DB{db, rdb} {
		for _, pragma := range []string{
			"journal_mode = WAL2",
			"busy_timeout = 5000",
			"synchronous = NORMAL",
			"cache_size = 1000000000", // 1GB
			"temp_store = memory",
		} {
			db.MustExec("PRAGMA " + pragma)
		}
	}

	r := ImageRepo{db: db, rdb: rdb}
	r.Init()

	return r
}

func (r ImageRepo) Add(i *Image) (err error) {
	i.Created = Epoch{time.Now()}
	re, err := r.db.Insert(i)
	if err != nil {
		return
	}

	id, err := re.LastInsertId()
	if err != nil {
		return
	}

	i.ID = int(id)
	return
}

func (r ImageRepo) Get(hash string) (img Image, err error) {
	err = r.rdb.Get(&img, "select * from "+img.TableName()+" where hash = ?", hash)
	return
}

func (r ImageRepo) ListByUser(uid, lastID, limit int) (imgs []Image, err error) {
	imgs = []Image{}
	err = r.rdb.Select(&imgs,
		"select * from "+(*Image).TableName(nil)+
			" where user_id = ? and id < ? order by id desc limit ?",
		uid, lastID, limit)
	return
}

func (r ImageRepo) Del(hash string, userID int) (err error) {
	_, err = r.db.Exec("delete from "+(*Image).TableName(nil)+" where hash = ? and user_id = ?", hash, userID)
	return
}

func (r ImageRepo) CleanBefore(t time.Time) (err error) {
	_, err = r.db.Exec("delete from "+(*Image).TableName(nil)+" where expires < ? and expires > 0", Epoch{t})
	return
}
