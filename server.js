const express = require('express')
const app = express()
const http = require('http')
const server = http.createServer(app)
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
const { v4: uuidV4 } = require('uuid')
const PORT = process.env.PORT || 3001;

console.log('[SERVER] welcome')
app.use(express.static('public'))
app.get('/', (req, res) => {
  const uuid = uuidV4()
  console.log('[SERVER] freqency: ', uuid)
  res.send(`${uuid}`)
})

const rooms = {}

const removeFromRoom = (room, id) => {
  try {
    const index = rooms[room].indexOf(id);
    if (index !== -1) {
      // if index is not undefined, lets remove that 1 item
      rooms[room].splice(index, 1)
    }
  } catch (error) {
    console.error('[SERVER] ', error)
  }
}

const reasonIsError = (reason) => {
  let hasError;
  switch (reason) {
    case 'ping timeout':
    case 'transport close':
    case 'transport error':
      hasError = true
      break;
  
    default:
      hasError = false;
  }

  return hasError;
}

io.on('connection', socket => {
  console.log('[SERVER] socket connected!', socket.id)

  socket.on('disconnect', (reason) => {
    console.log(`[SERVER] Desconnect ${socket.id} from ${socket.room}`)
    if (reasonIsError(reason) && socket.room) {
      removeFromRoom(socket.room, socket.id)
    }
  });

  socket.on('join-freq', data => {
    console.log('[SERVER] join-freq', data)
    const { room } = data
    // ====================== 2. Join or create room with userID ======================

    if (data.parent) {
      // Parents can only join
      if (rooms[room]) {
        rooms[room].push(socket.id);
        socket.room = room;
      }
    } else {
      // Babies can only create rooms
      rooms[room] = [socket.id]
      socket.room = room;
      socket.emit('confirm-room', true)
    }
    /*
        If both initiating and receiving peer joins the room,
        we will get the other user details.
        For initiating peer it would be receiving peer and vice versa.
    */
    let otherUserID = ''
    console.log('[SERVER] ', { rooms })
    if (rooms[room]) {
      otherUserID = rooms[room].find(id => id !== socket.id)
      console.log('[SERVER] ', rooms)
      console.log('[SERVER] ',{ otherUserID })
    }
    // ====================== 3. If there is other user, emit to JoinFreq ======================
    if (otherUserID) {
      socket.emit('other-user', otherUserID)
      socket.to(otherUserID).emit('user-joined', socket.id)
    }
    /*
        The initiating peer offers a connection
    */
    // ====================== 11. Listener to incoming Offer ======================
    socket.on('offer', payload => {
      console.log('[SERVER] offer')
      // ====================== 12. Emit offer to targeted user ======================
      io.to(payload.target).emit('offer', payload)
    })

    /*
        The receiving peer answers (accepts) the offer
    */
    // ====================== 17. Listen to incoming answer ======================
    socket.on('answer', payload => {
      console.log('[SERVER] answer')
      // ====================== 18. Emit answer to targeted user ======================
      io.to(payload.target).emit('answer', payload)
    })

    // =========== 23. Listen to incoming ice candidate ============
    socket.on('ice-candidate', incoming => {
      console.log('[SERVER] ice-candidate')
      // =========== 24. Emit ice candidate to tageted user ============
      io.to(incoming.target).emit('ice-candidate', incoming)
    })

    socket.on('end', room => {
      let otherUserID = '';
      if (rooms[room]) {
        otherUserID = rooms[room].find(id => id !== socket.id)
        // console.log(rooms)
        // console.log({ otherUserID })
      }
      console.log('[SERVER] end')
      console.log(`[SERVER] ${rooms[room]}`)
      delete rooms[room]
      console.log(`[SERVER]`, { rooms })

      // closeRoom(id)
      if (otherUserID) {
        socket.to(otherUserID).emit('end')
      }
    })

    socket.on('switch-camera', () => {
      console.log('[SERVER] Switching Camera')
      io.emit('switch-camera')
    })

    socket.on('toggle-audio', () => {
      console.log('[SERVER] Toggle audio')
      io.emit('toggle-audio')
    })
  })
})

server.listen(PORT, () => console.log('[SERVER] server is running @', PORT))
