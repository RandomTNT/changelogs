const databaseUrl = 'https://raw.githubusercontent.com/misode/MinecraftArticles/master/articles.json'
const changelogUrl = (id) => `https://raw.githubusercontent.com/misode/MinecraftArticles/master/articles/${id}.md`

const MAX_SEARCH_RESULTS = 20

let fuse;
let database = {}
let changelogs = {}
let search = ''

fetch(databaseUrl).then(async (res) => {
  database = await res.json()
  let data = []
  for await (const result of getChangelogs(database)) {
    const lines = result.content.split('\n').filter(l => l.length > 0).map(processLine)
    changelogs[result.id] = lines
    const split = lines.map((line, index) => ({
      id: result.id,
      index: index,
      content: line
    }))
    data = [...data, ...split]
    fuse = new Fuse(data, {
      keys: ['content'],
      distance: 100000,
      minMatchCharLength: 3,
      includeMatches: true
    })
    $('#load-progress').text(`Loaded ${Object.keys(changelogs).length} / ${Object.keys(database).length}`)
  }
  console.log(`Finished loading data. Changelogs: ${Object.keys(changelogs).length}. Lines: ${data.length}`)
})

async function* getChangelogs(database) {
  const lastId = Object.keys(database).pop()
  localStorage.removeItem(`changelog.${lastId}`)
  for (const id of Object.keys(database).reverse()) {
    let content = localStorage.getItem(`changelog.${id}`)
    if (content === null) {
      const response = await fetch(changelogUrl(id))
      content = await response.text()
      localStorage.setItem(`changelog.${id}`, content)
    } else {
      await new Promise(r => setTimeout(r))
    }
    yield { id, content, url: database[id] }
  }
}

$(document).ready(() => {
  $('#search').keypress(function(e) {
    if(e.which == 13) {
      updateSearch($('#search').val())
    }
  })
})

function updateSearch(query) {
  if (search === query) return
  search = query
  const results = fuse.search(query)
  if (results.length > 0) {
    let html = results
      .filter(r => r.matches.length > 0)
      .slice(0, MAX_SEARCH_RESULTS)
      .map(getResultHtml)
      .join('')
    if (results.length > MAX_SEARCH_RESULTS) {
      html += '<span>...<span>'
    }
    $('#results').html(html)
    $('.search-result').click(evt => {
      const $el = $(evt.target).closest('.search-result')
      const html = getFullChangelog($el.attr('data-id'))
      $('#results').html(html)
      window.scrollTo(0, 0);
    })
  } else {
    $('#results').html('')
  }
}

function getResultHtml(result) {
  const id = result.item.id
  const full = changelogs[id]
  const selection = full.slice(result.item.index - 1, result.item.index + 4)
  const matches = result.matches[0].indices
    .sort(m => m[0] - m[1])
    .slice(0, 1)
  return `<div class="search-result" data-id="${id}@${result.item.index}@${JSON.stringify(matches)}">
    <div class="result-bar">
      <span class="version">${id}</span>
    </div>
    <div class="result-body">
      ${renderLine(selection[0])}
      ${renderLine(highlightLine(selection[1], matches))}
      ${renderLine(selection[2])}
      ${renderLine(selection[3])}
      ${renderLine(selection[4])}
    </div>
  </div>`
}

function highlightLine(line, matches) {
  const arr = line.split('')
  for (const m of matches) {
    arr.splice(m[0], m[1] - m[0] + 1, `<span class="highlighted">${arr.slice(m[0], m[1] + 1).join('')}</span>`)
  }
  return arr.join('')
}

function getFullChangelog(arg) {
  let [id, index, matches] = arg.split('@')
  index = parseInt(index) - 2
  matches = JSON.parse(matches)

  const full = changelogs[id].slice(2)
  full[index] = highlightLine(full[index], matches)
  return `<div class="search-result full">
    <div class="result-bar">
      <div>
        <span class="version">${id}</span>
        <span>${changelogs[id][1]}</span>
      </div>
      <span class="link"><a href="${database[id]}">minecraft.net</a></span>
    </div>
    <div class="result-body">
      ${full.map(renderLine).join('')}
    </div>
  </div>`
}

function renderLine(line) {
  if (line === undefined) return '<div></div>'
  return `<div>${line
    .replace(/\[([^\]]+)\]\((.+)\)/, '<a href="$2">$1</a>')
    .replace(/^#+(.+)/, '<h4>$1</h4>')
    .replace(/\*\*([^\*]+)\*\*/, '<strong>$1</strong>')
    .replace(/\*(.+)/, '<ul><li>$1</li></ul>')
  }</div>`
}

function processLine(line) {
  return line
    .replace(/\\/, '')
}

function clearCache() {
  for (const id of Object.keys(database)) {
    localStorage.removeItem(`changelog.${id}`)
  }
}
