class Nav {
  token = ''

  oninit() {
    this.token = localStorage.getItem('token')
  }

  view() {
    return m('nav', [
      m('ul', [
      m('li', m('a', {href:'/#/'}, [
        m('span', [
          m('span', {style:{color:'cyan','font-weight':'light'}}, 'Pic'),
          m('span', {style:{color:'orange'}}, 'r'),
          m('span', {style:{color:'gray','font-size':'0.5em'}}, '.zz.ac'),
        ]),
      ])),
      m('li', m('span')),
      m('li', m('a', {href:'/#/my'}, this.token ? '我的' : '访客')),
      m('li', m('a', {href:'/#/voyage'}, '发现')),
      m('li', m('a', {href:'/#/faq'}, 'FAQ')),
    ]),
    m('p', '匹克图床，面向互联网爱好者学习和研究的公益图床'),
    ])
  }
}

class Footer {
  view() {
    return m('footer', m('p', [
      '© 2025 ',
      m('a',{href:'https://nic.zz.ac'},'ZZ.NIC'),
    ]))
  }
}

class Layout {
  view(vnode) {
    return m('div', [
      m(Nav),
      vnode.children,
      m(Footer),
    ])
  }
}

class Home {
  file
  blob
  imgURL = ''
  hash = ''
  token = ''
  autoUpload = false

  preview() {
    if (this.autoUpload) {
      this.upload()
      return
    }

    if (this.blob) {
      this.imgURL = URL.createObjectURL(this.blob)
      m.redraw()
      return
    }

    if (!this.file) {return}

    let r = new FileReader()
    r.onload = e => {
      this.imgURL = e.target.result
      m.redraw()
    }
    r.readAsDataURL(this.file)
  }
  upload() {
    let f = new FormData()

    if (this.file) {
      f.append('file', this.file)
    } else if (this.blob) {
      f.append('file', this.blob, 'paste')
    } else {
      return
    }

    fetch('/', {
      method: 'post',
      headers: {
        'authorization': `Bearer ${this.token}`,
      },
      body: f,
    }).then(res => {
        if (!res.ok) {
          res.text().then(alert);
        } else {
          res.json().then(img => {
            if (this.autoUpload) {
              let url = location.origin + '/' + img.hash
              navigator.clipboard.writeText(url)
            }
            m.route.set('/img/'+img.hash)
          })
        }
      })
  }
  oninit() {
    let args = new URLSearchParams(location.search)
    let token = args.get('token')
    if (token) {
      fetch('/token?token='+token).then(res => {
        if (res.ok) {
          res.text().then(token => {
            localStorage.setItem('token', token)
          })
        } else {
          res.text().then(alert)
        }
        m.route.set('/')
      })
    } else {
      this.token = localStorage.getItem('token')
      this.autoUpload = localStorage.getItem('auto-upload') === 'true'
    }
  }
  select(e) {
    e.target.parentNode.querySelector('input[type="file"]').click()
  }
  view() {
    return m('div', {
      onpaste: async e => {
        let items = await navigator.clipboard.read()
        for (let item of items) {
          let types = item.types.filter(t => t.startsWith('image/'))
          for (let t of types) {
            this.blob = await item.getType(t)
            this.preview()
            break
          }
        }
      },
      ondragenter: e => { e.target.style.borderWidth = '3px'; },
      ondragover: e => { e.preventDefault() },
      ondragleave: e => { e.target.style.borderWidth = '1px'; },
      ondrop: e => {
        e.preventDefault()
        e.target.style.borderWidth = '1px';
        for (let item of e.dataTransfer.items) {
          this.file = item.getAsFile()
          this.preview()
          break
        }
      },
      style: {
        border: '1px dashed gray',
        padding: '0.5em',
        'border-radius': '0.5em',
        'margin': '0.5em 0',
      },
    }, [
        ...(this.imgURL ? [
          m('img', {
            src:this.imgURL,
            style: {
              display: 'block',
              'margin-bottom': '0.5em',
            },
          }),
          m('button', { onclick: e => { this.upload() } }, '上传'),
        ]: []),
        m('button', { onclick: e => { this.select(e) } },'选择图片'),
        m('span', {style: {display:'inline-flex'}}, [
          m('input', {
            type: 'checkbox',
            id: 'auto-upload',
            checked: this.autoUpload,
            onchange: e => {
              localStorage.setItem('auto-upload', e.target.checked)
              this.autoUpload = e.target.checked
            },
          }),
          m('label', { for: 'auto-upload' }, '自动上传并复制图片链接到剪切板'),
        ]),
        m('p', {style:{'margin':0}}, '从文件系统选择或者拖拽图片或者从剪贴板粘贴图片'),
        m('input', {
          type: 'file',
          accept: 'image/*',
          style: {display:'none'},
          onchange: e => {
            if (e.target.files.length === 1) {
              this.file = e.target.files[0]
              e.target.value = ''
              this.preview()
            }
          },
        }),
      ]
    )
  }
}

class Auth {
  email = ''

  view() {
    return m('div',[
      m('input', {
        placeholder: '输入QQ邮箱',
        onchange: e => {
          this.email = e.target.value.trim()
        },
      }),
      m('button', {
        onclick: e => {
          let f = new FormData()
          f.append('e', this.email)
          fetch('/token', {
            method: 'post',
            body: f,
          }).then(res => {
              if (!res.ok) {
                res.text().then(alert);
              } else {
                alert('Link has been sent to you Email Inbox.');
              }
            })
        },
      },'发送认证链接')
    ])
  }
}

class ImageBox {
  view(vnode) {
    let img = vnode.attrs.img
    let onlyImg = vnode.attrs.onlyImg
    return [
      m('img', {
        src: img.src,
        'data-action': 'info',
        'data-hash': img.hash,
        style: {
          display: 'block',
          width: '100%',
          'border-radius': '10px',
          'background-color': 'var(--text-main)',
        },
      }),
      onlyImg ? null : m('div', new Date(img.created).toLocaleString()),
    ]
  }
}

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      observer.unobserve(entry.target)
      entry.target.click()
    }
  });
});

class ImageMasonry {
  onupdate(vnode) {
    let macy = Macy({
      container: vnode.dom,
      margin: 8,
      columns: 3,
    });
  }

  view(vnode) {
    let imgs = vnode.attrs.imgs
    return m('ul', {
      style: {
        padding: 0,
      },
      onclick: e => { vnode.attrs.action(e.target) },
    }, imgs.map(img => m('li', {
        key: img.id,
        style: {
          display: 'inline-block',
        },
      }, m(ImageBox, {img, onlyImg:vnode.attrs.onlyImg})
      ))
    )
  }
}

class Mine {
  token = ''
  imgs = []
  domains = []
  me = {}
  nomore = false

  lastId = Number.MAX_SAFE_INTEGER

  loadMore() {
    fetch('/list?l='+this.lastId, {
      headers: {
        'authorization': `Bearer ${this.token}`,
      }
    }).then(res => {
        if (!res.ok) {
          res.text().then(alert);
        } else {
          res.json().then(imgs => {
            if (imgs.length === 0) {
              this.nomore = true
              return
            }
            for (let img of imgs) {
              img.src = location.origin + '/' + img.hash 
              this.imgs.push(img)
            }
            this.lastId = this.imgs[this.imgs.length-1].id
            m.redraw()
          })
        }
      })
  }

  updateDomains() {
    if (this.me.domains.length === 0) {return}

    let f = new FormData();
    f.append('domains', this.me.domains)
    fetch('/domain', {
      method: 'post',
      headers: {
        'authorization': `Bearer ${this.token}`,
      },
      body: f,
    }).then(res => {
        if (res.ok) {
          alert('update domains successfully')
        } else {
          res.text().then(alert)
        }
      })
  }

  oninit() {
    this.token = localStorage.getItem('token')
    if (!this.token) {
      m.route.set('/auth')
      return
    }

    fetch('/me', {
      headers: {
        'authorization': `Bearer ${this.token}`,
      }
    }).then(res => {
        if (!res.ok) {
          res.text().then(alert);
        } else {
          res.json().then(u => {
            this.me = u
            m.redraw()
          })
        }
      })

    if (this.imgs.length == 0) {
      this.loadMore()
    }
  }

  onupdate(vnode) {
    if (!this.nomore) {
      observer.observe(vnode.dom.lastChild)
    }
  }

  action(target) {
    switch (target.dataset.action) {
      case 'copy':
        navigator.clipboard.writeText(target.dataset.url).then(() => {
          target.innerText = '✅'
          setTimeout(() => { target.innerText = '📋' }, 2000)
        })
      break
      case 'drop':
        fetch(target.dataset.url, {
          method: 'delete',
          headers: {
            'authorization': `Bearer ${this.token}`,
          },
        }).then(res => {
            if (res.ok) {
              this.imgs = this.imgs.filter(img => img.id != target.dataset.id)
              m.redraw()
            } else {
              res.text().then(alert)
            }
          })
      break
      case 'info':
        m.route.set('/img/'+target.dataset.hash)
        break
      break
    }
  }

  view() {
    return m('div', [
      m('h2', '个人信息'),
      m('div', [m('div','电子邮件: '), m('code', this.me.email)]),
      m('div', [m('div','加入时间: '), m('code', new Date(this.me.created).toLocaleString())]),
      m('div', [m('div','上传令牌: '), m('code', this.token)]),
      m('label', {for:'domains'}, '外链域名白名单: '),
      m('textarea', {
        id:'domains',
        rows: 5,
        style: {
          display: 'block',
        },
        value: this.me.domains || '',
        onchange: e => { this.me.domains = e.target.value.trim() },
      }),
      m('button', { onclick: this.updateDomains.bind(this), }, '更新白名单'),
      m('h2', '图片列表'),
      m('p', '点击图片查看详情'),
      m(ImageMasonry, { imgs:this.imgs, action: this.action.bind(this) }),
      this.nomore ? null : m('button', { onclick: this.loadMore.bind(this) }, '显示后续图片...'),
    ])
  }
}

class Voyage {
  imgs = []
  nomore = false

  lastId = Number.MAX_SAFE_INTEGER

  loadMore() {
    fetch(`/voyage?l=${this.lastId}`).then(res => {
      if (!res.ok) {
        res.text().then(alert);
      } else {
        res.json().then(imgs => {
          if (imgs.length === 0) {
            this.nomore = true
            return
          }
          for (let img of imgs) {
            img.src = location.origin + '/' + img.hash 
            this.imgs.push(img)
          }
          this.lastId = this.imgs[this.imgs.length-1].id
          m.redraw()
        })
      }
    })
  }

  action(target) {
    switch (target.dataset.action) {
      case 'info':
        m.route.set('/img/'+target.dataset.hash)
        break
        break
    }
  }

  oninit() {
    if (this.imgs.length == 0) {
      this.loadMore()
    }
  }

  onupdate(vnode) {
    if (!this.nomore) {
      observer.observe(vnode.dom.lastChild)
    }
  }

  view() {
    return m('p', [
      m('h2', '发现图片'),
      m(ImageMasonry, { imgs:this.imgs, action: this.action.bind(this), onlyImg:true }),
      this.nomore ? null : m('button', { onclick: this.loadMore.bind(this) }, '显示后续图片...'),
    ])
  }
}

class Image {
  token = ''

  oninit(vnode) {
    this.token = localStorage.getItem('token')

    let hash = m.route.param('hash')

    fetch('/img/'+hash).then(res => {
      if (!res.ok) {
        res.text().then(alert)
        m.route.set('/')
        return
      }
      res.json().then(img => {
        this.img = img
        m.redraw()
      })
    })
  }

  view(vnode) {
    if (!this.img) {
      return m('div', [
        m('figure'),
      ])
    }

    this.img.src = location.origin + '/' + this.img.hash

    return m('div', {
      style: {'text-align': 'center', 'font-family': 'monospace'}
    },[
      m('figure', [
        m('img', { src: this.img.src, }),
        m('figcaption', this.img.src),
        m('table', {style:{'margin-top':'1em'}}, [
          m('thead',
            m('tr', [
              m('th', '上传用户'),
              m('th', '上传时间'),
              m('th', '过期时间'),
              m('th', '上传地址'),
            ])
          ),
          m('tbody',
            this.img.users.map(u => {
              return m('tr', [
                m('td', u.user_id > 0 ? '#'+u.user_id : '访客'),
                m('td', new Date(u.created).toLocaleString()),
                m('td', u.expires.startsWith('0001') ? '永不过期' : new Date(u.expires).toLocaleString()),
                m('td', u.user_ip ? u.user_ip : '不公开'),
              ])
            }),
          ),
        ]),
        m('button', {
          'data-url': this.img.src,
          onclick: e => {
            fetch(e.target.dataset.url, {
              method: 'delete',
              headers: {
                'authorization': `Bearer ${this.token}`,
              },
            }).then(res => {
                if (!res.ok) {
                  res.text().then(alert)
                } else {
                  if (this.token) {
                    m.route.set('/my')
                  } else {
                    m.route.set('/')
                  }
                }
              })
          },
        }, '删除'),
      ]),
    ])
  }
}

m.route(document.body, '/', {
  '/': { render: () => m(Layout, m(Home)) },
  '/my': { render: () => m(Layout, m(Mine)) },
  '/auth': { render: () => m(Layout, m(Auth)) },
  '/img/:hash': { render: () => m(Layout, m(Image)) },
  '/voyage': { render: () => m(Layout, m(Voyage)) },
})
