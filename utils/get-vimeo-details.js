require('dotenv').config()

const fs = require('fs')
const path = require('path')
const editor = require('front-matter-editor')
const { Vimeo } = require('vimeo')
const vimeoClient = new Vimeo(process.env.VIMEO_CLIENT_ID, process.env.VIMEO_CLIENT_SECRET, process.env.VIMEO_ACCESS_TOKEN)

const base = './content/library/videos'
const vimeoFolderName = 'Happy Healthy Communication'

function getFilePaths() {
    const dirs = fs.readdirSync(base)
    const files = dirs.map(dir => fs.readdirSync(base + '/' + dir).map(name => base + '/' + dir + '/' + name)).flat()
    return files
}

function vimeo(path) {
    return new Promise((resolve, reject) => {
        vimeoClient.request(path, (err, { data }) => {
            if(err) reject(err)
            resolve(data)
        })
    })
}

async function getVimeoMetaData(folderName) {
    const vimeoFolders = await vimeo(`/users/${process.env.VIMEO_USER_ID}/projects`)
    const folder = vimeoFolders.find(f => f.name == vimeoFolderName)
    const vimeoVideos = await vimeo(`${folder.uri}/videos`)
    const vimeoVideosMetadata = vimeoVideos.map(v => ({
        duration: Math.round(v.duration/60),
        image: v.pictures.base_link,
        id: v.uri.split('/')[2]
    }))
    return vimeoVideosMetadata
}

function getFileByVideoId(videoId) {
    return new Promise((resolve, reject) => {
        fs.readdirSync(base).forEach(dir => {
            const dirPath = base + '/' + dir
            fs.readdirSync(dirPath).forEach(file => {
                const filePath = dirPath + '/' + file
                editor.read(filePath).data((data, matter) => {
                    if(data.vimeo == videoId) resolve(filePath)
                })
            })
        })
    })
}

function removeLastPartOfFileName(fileName) {
    let arr = fileName.split('/')
    let correctSegs = arr.pop()
    return arr.join('/')
}

async function updateFilesWithMetadata(files, metadatas) {
    for(let vimeo of metadatas) {
        const file = await getFileByVideoId(vimeo.id)
        const metadata = metadatas.find(m => m.id == vimeo.id)
        editor.read(file).data((data, matter) => {
            data.duration = metadata.duration
            data.cover = metadata.image
            matter.data = data
        }).save(removeLastPartOfFileName(file), null, (err) => console.log(`${err ? err : 'Wrote file'}`))
    }
}

async function main() {
    try {
        const files = getFilePaths()
        const metadata = await getVimeoMetaData()
        console.log({ metadata })
        await updateFilesWithMetadata(files, metadata)
    } catch(error) {
        console.error({ error })
    }
}

main()
