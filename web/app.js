import MiniMasonry from "./minimasonry.js";

m.route.prefix = '#'

class Nav {
  token = ''

  oninit() {
    this.token = localStorage.getItem('token')
  }

  view() {
    return m('nav', [
      m('ul', [
        m('li', m('a', {href:'/'}, [
          m('span', [
            m('span', {style:{color:'var(--text-main)'}}, 'Pic'),
            m('span', {style:{color:'orange'}}, 'r'),
            m('span', {style:{color:'gray','font-size':'0.5em'}}, '.zz.ac'),
          ]),
        ])),
        m('li', m('span')),
        m('li', m(m.route.Link, {href:'/my', disabled: m.route.get() == '/my'}, '👤我的')),
        m('li', m(m.route.Link, {href:'/voyage', disabled: m.route.get() == '/voyage'}, '🚀发现')),
        m('li', m(m.route.Link, {href:'/faq', disabled: m.route.get() == '/faq'}, '🤔FAQ')),
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

class Toast {
  view(vnode) {
    return m('output.gui-toast', {
      role:'status',
      style: {
        'max-inline-size': 'min(50ch, 90vw)',
        'padding-block': '.5ch',
        'padding-inline': '1ch',
        'border-radius': '3px',
        'font-size': '1rem',
        '--_bg-lightness': '90%',
        'color': 'black',
        'background': 'hsl(0 0% var(--_bg-lightness) / 90%)',
        '--_duration': '3s',
        '--_travel-distance': '0',
        'will-change': 'transform',
        'animation': 'fade-in .3s ease, slide-in .3s ease',
      },
    }, vnode.attrs.data.content)
  }
}

class ToastGroup {
  id = 0

  view(vnode) {
    let toasts = vnode.attrs.toasts
    return m('section.gui-toast-group', {
      style: {
        'position': 'fixed',
        'z-index': 1,
        'inset-block-end': 0,
        'inset-inline': 0,
        'padding-block-end': '5vh',
        'display': 'grid',
        'justify-items': 'center',
        'justify-content': 'center',
        'gap': '1vh',
        'pointer-events': 'none',
      },
    }, toasts.map(t => {
        t.id = this.id++
        setTimeout(() => {
          for (let i = 0; i < toasts.length; i++) {
            if (toasts[i].id === t.id) {
              toasts.splice(i, 1)
              m.redraw()
              break
            }
          }
        }, 3000)
        return m(Toast, {data:t})
      }))
  }
}

class Layout {
  toasts = []

  oninit() {
    m.toasts = (content) => {
      this.toasts.push({
        content: content,
      })
      m.redraw()
    }
  }

  view(vnode) {
    return m('div', [
      m(Nav),
      vnode.children,
      m(Footer),
      m(ToastGroup, {toasts: this.toasts}),
    ])
  }
}

class Checkbox {
  view(vnode) {
    let {label,id,checked,onchange} = vnode.attrs
    return m('span', {style: {display:'inline-flex'}}, [
      m('input', {
        type: 'checkbox',
        id,
        checked,
        onchange,
      }),
      m('label', { for: id }, label),
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
  showDetail = false

  progress = 0

  dom = null

  preview() {
    this.progress = 0

    if (this.autoUpload) {
      this.upload()
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
  async upload() {
    let size = 0
    let f = new FormData()

    if (this.file) {
      f.append('file', this.file)
      size = this.file.size
    } else if (this.blob) {
      f.append('file', this.blob, 'paste')
      size = this.blob.size
    } else {
      return
    }

    let r = await fetch('/', { method: 'options' })

    if (!r.ok) {
      res.text().then(m.toasts)
      return
    }

    let max = r.headers.get('picr-max-image-size')
    if (size > max) {
      let mb = Math.round(max / 1024 / 1024)
      m.toasts(`数据量不能超过${mb}MB`)
      return
    }

    let xhr = new XMLHttpRequest()
    xhr.open('POST', '/', true)
    xhr.setRequestHeader('authorization', `Bearer ${this.token}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        this.progress = (e.loaded / e.total) * 100;
        m.redraw()
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let img = JSON.parse(xhr.responseText)

        this.imgURL = location.origin + '/' + img.hash
        navigator.clipboard.writeText(this.imgURL)
        m.toasts('图片链接已经复制到剪切板')

        if (this.showDetail) {
          m.route.set('/img/'+img.hash)
        }
      } else {
        m.toasts(xhr.responseText)
      }
    }

    xhr.onerror = m.toasts

    xhr.send(f);
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
          res.text().then(m.toasts)
        }
        location.href = '/'
      })
    } else {
      this.token = localStorage.getItem('token')
      this.showDetail = localStorage.getItem('show-detail') === 'true'
      this.autoUpload = localStorage.getItem('auto-upload') === 'true'
    }
    document.onpaste = async e => {
      let items = await navigator.clipboard.read()
      for (let item of items) {
        let types = item.types.filter(t => t.startsWith('image/'))
        for (let t of types) {
          this.blob = await item.getType(t)
          this.preview()
          break
        }
      }
    }
  }
  oncreate(vnode) {
    this.dom = vnode.dom;
  }
  select() {
    this.dom.querySelector('input[type="file"]').click()
  }
  view() {
    return m('div.uploader', {
      ondragenter: e => { e.target.style.borderWidth = '3px' },
      ondragover: e => { e.preventDefault() },
      ondragleave: e => { e.target.style.borderWidth = '1px' },
      ondrop: e => {
        e.preventDefault()
        e.target.style.borderWidth = '1px'
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
        'box-sizing': 'border-box',
        margin: '0.5em 0',
        display: 'flex',
        'min-height': '50vh',
        'flex-direction': 'column',
        'align-items': 'center',
        'justify-content': 'center',
      },
    }, [
        this.imgURL ? m('div', {style:{flex:'1',display:'flex','align-items':'center'}}, [
          m('img', {
            src:this.imgURL,
            onclick: e => {
              if (this.imgURL.startsWith('http')) {
                navigator.clipboard.writeText(this.imgURL)
                m.toasts('原图链接已经复制到剪切板')
              }
            },
            style: {
              display: 'block',
              margin: '0 auto',
            },
          }),
        ]): null,
        m('div', {style:{'text-align':'center', width: '100%', 'pointer-events': 'none'}}, [
          this.imgURL ? m('progress', {
            max:100,
            value:this.progress,
            style:{
              width: '100%',
            },
          }) : null,
          this.imgURL ? m('button', { onclick: e => { this.upload() } }, '上传') : null,
          m('button', { onclick: e => { this.select(e) } },'选择图片'),
          m('span.btn-sep'),
          m(Checkbox, {
            id: 'auto-upload',
            label: '自动上传',
            checked: this.autoUpload,
            onchange: e => {
              localStorage.setItem('auto-upload', e.target.checked)
              this.autoUpload = e.target.checked
            },
          }),
          m(Checkbox, {
            id: 'auto-no-preview',
            label: '跳转图片页',
            checked: this.showDetail,
            onchange: e => {
              localStorage.setItem('show-detail', e.target.checked)
              this.showDetail = e.target.checked
            },
          }),
          m('p', {style:{'margin':0}}, '从文件系统选择或者拖拽图片或者从剪贴板粘贴图片'),
          m('p', {style:{'margin':0}}, '当前支持 PNG/JPG/GIF/WEBP 四种图片格式'),
        ]),
        m('input', {
          type: 'file',
          accept: 'image/png,image/jpeg,image/gif,image/webp',
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

  oninit() {
    localStorage.removeItem('token')
  }

  view() {
    return m('div',[
      m('h1', '身份验证'),
      m('p', '当前仅支持通过QQ邮箱验证身份'),
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
                res.text().then(m.toasts)
              } else {
                m.toasts('验证链接已经发送到你的邮箱')
              }
            })
        },
      },'发送验证链接')
    ])
  }
}

class ImageBox {
  view(vnode) {
    let {img,noflag} = vnode.attrs
    return [
      m('img', {
        src: img.src,
        'data-action': 'link',
        'data-hash': img.hash,
        style: {
          display: 'block',
          width: '100%',
          'border-radius': '10px',
          'background-color': 'hsl(0 0% 95% / 1)',
        },
      }),
      m('.action-bar.bottom', [
        m('span.action', {
          'data-action': 'drop',
          'data-id': img.id,
          'data-url': img.src,
          title:'可以删除自己与游客上传的图片',
        }, '🗑️'),
        !noflag ? m('span.action', {
          'data-action': 'flag',
          'data-url': img.src,
          title:'举报恶意内容',
        }, '📤') : null,
      ]),
    ]
  }
}

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.click()
    }
  })
})

class ImageMasonry {
  imgs = []
  token = ''

  oninit(vnode) {
    this.imgs = vnode.attrs.imgs
    this.token = localStorage.getItem('token')
  }

  oncreate(vnode) {
    if (!vnode.attrs.nomore) {
      observer.observe(vnode.dom.querySelector('span.more'))
    }
  }

  onupdate(vnode) {
    let masonry = new MiniMasonry({
      container: vnode.dom,
    })
    let more = vnode.dom.querySelector('span.more')
    if (more && more.getBoundingClientRect().top <= window.innerHeight) {
      more.click()
    }
  }

  drop(data) {
    fetch(data.url, {
      method: 'delete',
      headers: {
        'authorization': `Bearer ${this.token}`,
      },
    }).then(res => {
        if (!res.ok) {
          res.text().then(m.toasts)
        } else {
          for (let i = 0; i < this.imgs.length; i++) {
            if (this.imgs[i].id == data.id) {
              this.imgs.splice(i, 1)
              m.redraw()
              break
            }
          }
        }
      })
  }

  flag(data) {
    let f = new FormData()
    f.append('l', data.url)

    fetch('/flag', {
      method: 'post',
      headers: {
        'authorization': `Bearer ${this.token}`,
      },
      body: f,
    }).then(res => {
        if (!res.ok) {
          res.text().then(m.toasts)
        } else {
          m.toasts('感谢举报恶意内容')
        }
      })
  }

  action(target) {
    switch (target.dataset.action) {
      case 'link':
        navigator.clipboard.writeText(target.src)
        m.toasts('原图链接已经复制到剪切板')
        break
      case 'drop':
        this.drop(target.dataset)
        break
      case 'flag':
        this.flag(target.dataset)
        break
    }
  }

  view(vnode) {
    let {imgs,noflag,nomore,loadMore} = vnode.attrs
    return m('ul[class="image-masonry"]', {
      style: { padding: 0, position: 'relative' },
      onclick: e => { this.action(e.target) },
    }, [
        ...imgs.map(img => {
          let [w,h] = img.size.split('x')
          return m('li', {
            key: img.id,
            'data-radio': h/w,
            style: { display: 'inline-block', position: 'absolute' },
          }, m(ImageBox, {img,noflag}))
        }),

        m('li', { key: 0, 'data-radio': 0 },
          nomore ? null : m('span.more', { onclick: e => { loadMore() }, }),
        ),
      ]
    )
  }
}

class Mine {
  token = ''
  imgs = []
  domains = []
  me = {}
  nomore = false
  loading = false

  loadMore() {
    if (this.loading) { return }

    this.loading = true

    let lastId = Number.MAX_SAFE_INTEGER
    if (this.imgs.length > 0) {
      lastId = this.imgs[this.imgs.length-1].id
    }

    fetch(`/list?l=${lastId}`, {
      headers: {
        'authorization': `Bearer ${this.token}`,
      }
    }).then(res => {
        if (!res.ok) {
          if (res.status === 401) {
            m.route.set('/auth')
          } else {
            res.text().then(m.toasts)
          }
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
            m.redraw()
          })
        }
      }).finally(() => { this.loading = false })
  }

  updateDomains() {
    let f = new FormData()
    f.append('domains', this.me.domains)
    fetch('/domain', {
      method: 'post',
      headers: {
        'authorization': `Bearer ${this.token}`,
      },
      body: f,
    }).then(res => {
        if (res.ok) {
          m.toasts('更新成功')
        } else {
          res.text().then(m.toasts)
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
          if (res.status === 401) {
            m.route.set('/auth')
          } else {
            res.text().then(m.toasts)
          }
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

  view() {
    return m('div', [
      m('h1', '我的页面'),
      m('p', '当前页面信息仅自己可见！'),
      m('h2', '个人信息'),
      m('div', [m('div','电子邮件'), m('code', this.me.email)]),
      m('div', [m('div','加入时间'), m('code', new Date(this.me.created).toLocaleString())]),
      m('div', [m('div','上传令牌'), m('code', {
        onclick: e => {
          navigator.clipboard.writeText(e.target.innerText)
          m.toasts('上传令牌链接已经复制到剪切板')
        },
      }, this.token)]),
      m('label', {for:'domains'}, '外链域名白名单'),
      m('textarea', {
        id:'domains',
        rows: 5,
        style: {
          display: 'block',
        },
        value: this.me.domains || '',
        onchange: e => { this.me.domains = e.target.value.trim() },
      }),
      m('button', { onclick: e => {this.updateDomains()} }, '更新白名单'),
      m('h2', '图片列表'),
      m(ImageMasonry, {
        imgs:this.imgs,
        loadMore: e => { this.loadMore() },
        nomore: this.nomore,
        noflag: true,
      }),
    ])
  }
}

class Voyage {
  imgs = []
  nomore = false
  loading = false

  loadMore() {
    if (this.loading) { return }

    this.loading = true

    let lastId = Number.MAX_SAFE_INTEGER
    if (this.imgs.length > 0) {
      lastId = this.imgs[this.imgs.length-1].id
    }

    fetch(`/voyage?l=${lastId}`).then(res => {
      if (!res.ok) {
        res.text().then(m.toasts)
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
          m.redraw()
        })
      }
    }).finally(() => { this.loading = false })
  }

  oninit(vnode) {
    this.loadMore()
  }

  view() {
    return m('div', [
      m('h1', '发现图片'),
      m(ImageMasonry, {
        imgs: this.imgs,
        loadMore: this.loadMore.bind(this),
        nomore: this.nomore,
      }),
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
        res.text().then(m.toasts)
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

    return m('div', [
      m('h1', '图片详情'),
      m('figure', {style:{'margin':'0','text-align':'center'}}, [
        m('img', {
          src: this.img.src,
          onclick: e => {
            navigator.clipboard.writeText(e.target.innerText).then(m.toasts('原图链接已经复制到剪切板'))
          },
        }),
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
            let f = new FormData()
            f.append('f', '1')

            fetch(e.target.dataset.url, {
              method: 'delete',
              headers: {
                'authorization': `Bearer ${this.token}`,
              },
              body: f,
            }).then(res => {
                if (!res.ok) {
                  if (res.status === 401) {
                    m.route.set('/auth')
                  } else {
                    res.text().then(m.toasts)
                  }
                } else {
                  m.route.set('/')
                }
              })
          },
        }, '删除'),
        m('button', {
          'data-url': this.img.src,
          onclick: e => {
            let f = new FormData()
            f.append('l', e.target.dataset.url)

            fetch('/flag', {
              method: 'post',
              headers: {
                'authorization': `Bearer ${this.token}`,
              },
              body: f,
            }).then(res => {
                if (!res.ok) {
                  res.text().then(m.toasts)
                } else {
                  m.toasts('感谢举报恶意内容')
                }
              })
          },
        }, '举报'),
      ]),
    ])
  }
}

class FAQ {
  faqs = [
    {
      q:'为什么提供图床服务',
      a:'Picr.zz.ac 是 <a href="https://nic.zz.ac">ZZ.AC</a> 公益项目的一部分，利用自有资源为互联网爱好者学习交流提供服务。',
    },
    {
      q:'有什么特色功能',
      a:'<p>支持游客上传，但上传的图片只保存 20 分钟。提供发现页面，可以浏览所有上传的图片。</p><p>单一程序，单个 SQLite 文件，跨平台，方便部署。</p>',
    },
    {
      q:'有什么防滥用措施',
      a:'游客上传图片二十分钟过期，上传时的 IP 地址会公开展示。普通用户需要通过 QQ 邮箱验证身份。普通用户的图片需要配置外链域名白名单才能使用。所有图片都公开展示，提供删除和举报功能。',
    },
    {
      q:'会收集哪些用户信息',
      a:'用户 IP 地址、User-Agent、电子邮箱。',
    },
    {
      q:'为什么只允许 QQ 邮箱',
      a:'QQ 邮箱基本上人人都有。不太有人用 QQ 邮箱做坏事。',
    },
    {
      q:'支持 API 上传吗',
      a:'支持。验证身份之后会生成上传令牌，具体上传接口可以通过浏览器抓包获取。',
    },
    {
      q:'图床使用哪些技术',
      a:'服务端使用 Go 语言+SQLite，Web 端使用 <a href="https://mithril.js.org/">Mithril.js</a>，纯原生 JavaScript 项目，不依赖构建工具。No TypeScript!',
    },
    {
      q:'代码开源吗',
      a:'代码托管在<a href="https://github.com/taoso/picr">github.com/taoso/picr</a>，欢迎参与建设。同时也提供定制服务。',
    },
  ]
  view() {
    return [
      m('h1', 'FAQ'),
      ...this.faqs.map(faq => [m('h2', faq.q), m('p', m.trust(faq.a))]),
    ]
  }
}

m.route(document.body, '/', {
  '/': { render: () => m(Layout, m(Home)) },
  '/my': { render: () => m(Layout, m(Mine)) },
  '/faq': { render: () => m(Layout, m(FAQ)) },
  '/auth': { render: () => m(Layout, m(Auth)) },
  '/img/:hash': { render: () => m(Layout, m(Image)) },
  '/voyage': { render: () => m(Layout, m(Voyage)) },
})
