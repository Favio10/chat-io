import express from 'express'
import logger from 'morgan'
import dotenv from 'dotenv'
import { createClient } from '@libsql/client'

import { Server } from 'socket.io'
import {createServer} from 'node:http'

dotenv.config()

const port = process.env.PORT ?? 3000

const app = express()
const server = createServer(app)
const io = new Server(server, {
    //con esto de abajo hago que si se desconecta el destinatario, cuando se conecte le lleguen los msj
    connectionStateRecovery: {}
})

const db = createClient({
    url: "libsql://shining-dusk-foci10.turso.io",
    authToken: process.env.DB_TOKEN,
})

await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    user TEXT
    )
    `)

io.on('connection', async (socket) => {
    console.log('a user has connectede!');

    socket.on('disconnect', () => {
        console.log('an user has disconnect');
    })
     // con el io.emit espacimos el mensaje con todos los clientes
    socket.on('chat message', async (msg) => {
        let result
        const username = socket.handshake.auth.username ?? 'anonymus'
        try {
           
            result = await db.execute({
                sql: 'INSERT INTO messages (content, user) VALUES (:msg, :username)',
                args: { msg , username}
            })
        } catch (e) {
            console.error(e);
            return
        }
        //id del message insertado
        io.emit('chat message', msg, result.lastInsertRowid.toString(), username)
    })


    if (!socket.recovered) {
        try {
            const result = await db.execute({
                sql: 'SELECT id, content, user FROM messages WHERE id > ?',
                args: [socket.handshake.auth.serverOffset ?? 0]
            })

            result.rows.forEach(row => {
                socket.emit('chat message', row.content, row.id.toString(), row.user)
            })
        }catch (e) {
     console.error(e)   
    }
    } 
})


app.use(logger('dev'))

app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/client/index.html')
})

server.listen(port, () => {
    console.log(`server running on port ${port}`);
})