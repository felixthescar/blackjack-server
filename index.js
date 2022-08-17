const express = require('express');
const app = express();
const path = require ('path');
const server = require ('http').createServer(app);
const io = require ('socket.io')(server);
const port = process.env.PORT || 8000;
const root = path.join(__dirname);
const sleep = require ('system-sleep')
app.use(express.static(root + '/public'))

var sockets = []
var playerData = {}
var dealerHand = []

var gameRunning = false;
var roundFinished = false;
function run() {

}

function randomCard() {
    var signs = ['D', 'C', 'H', 'S'];
    var sign = signs[Math.floor(Math.random() * signs.length)];
    var numbers = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A', 'J', 'Q', 'K'];
    var number = numbers[Math.floor(Math.random() * numbers.length)];
    return {'sign': sign, 'number': number}
}

function generateCard(socket) {
    var id = randomCard();
    id['id'] = socket.id;
    id['bust'] = false;
    var value = 0;
    if(id.number == 'A') {
        playerData[socket.id].hasA = true;
        value += 1;
    }
    else if(id.number == 'K' || id.number == 'Q' || id.number == 'J') value += 10;
    else value += parseInt(id.number);
    playerData[socket.id].hand.push(value);
    var sum = 0;
    playerData[socket.id].hand.forEach(element => {
        sum += element;
    });
    if(sum > 21) {
        playerData[socket.id].hand = [];
        playerData[socket.id].bust = true;
        id['bust'] = true;
    }
    if(sum >= 21) {
        playerData[socket.id].finishedHand = true;
    }
    playerData[socket.id].handValue = sum;
    sockets.forEach(socket => {
        socket.emit('receiveCard', id);

    });
    if(playerData[socket.id].finishedHand || playerData[socket.id].bust) {
        var index = -1;
        for (var i = 0; i < sockets.length-1; i ++) {
            if(sockets[i] == socket) index = i+1;
        }
        playerData[socket.id].myTurn = false;
        if(index != -1) playerData[sockets[index].id].myTurn = true;
        else dealerLogic();
    }
    
}

function resetRound() {
    sockets.forEach(socket => {
        playerData[socket.id].hand = [];
        playerData[socket.id].finishedHand = false;
        playerData[socket.id].hasA = false;
        playerData[socket.id].handValue = 0;
        playerData[socket.id].myTurn = false;
        playerData[socket.id].justJoined = false;
    });
    playerData[sockets[0].id].myTurn = true;
    dealerHand = [];
    roundFinished = false;
}

async function tryStartRound() {
    if(sockets.length == 0) {
        gameRunning = false;
        return;
    }
    gameRunning = true;
    resetRound();
}

async function dealerLogic() {
    var hasA = false;
    var sum = 0;
    while(true) {
        sum = 0;
        dealerHand.forEach(element => {
            if(element == 1) {
                hasA = true;
            }
            sum += element;
        });
        if(sum >= 17) {
            console.log('hand>=17')
            break;
        }
        else if(hasA && sum+10 >= 17 && sum+10 <= 21) {
            console.log('hand>=17')
            break;
        }
        var id = randomCard();
        var value = 0;
        if(id.number == 'A') value += 1;
        else if(id.number == 'K' || id.number == 'Q' || id.number == 'J') value += 10;
        else value += parseInt(id.number);
        var data = {'value': value, 'sign': id.sign}
        sockets.forEach(element => {
            element.emit('dealerCard', data);
        });
        dealerHand.push(value);
        console.log(dealerHand);
        //await sleep(1000);
    }
     
    console.log(sum);
    sockets.forEach(socket => {
        var msg = '';
        //dealer  as
        var sum2 = -1;
        if(hasA && sum + 10 < 22) {
            sum2 = sum + 10;
        }
        //jucator as
        var handValue = playerData[socket.id].handValue;
        var handValue2 = -1;
        if(playerData[socket.id].hasA && handValue+10 < 22) {
            handValue2 = handValue + 10;
        }
        //nimeni as 
        if(playerData[socket.id].bust) msg='playerLose';
        else if(sum > 21) {
            msg='playerWin';
        }
        else if(!playerData[socket.id].bust){
            if(
                (sum > handValue || sum2 > handValue) && 
                (sum > handValue2 || sum2 > handValue2)) {
                msg = 'playerLose';
            } else if((sum == handValue || sum2 == handValue) &&
                    (sum == handValue2 || sum2 == handValue2)){
                msg = 'playerPush';
            } else {
                msg = 'playerWin';
            }
        }
        //amandoi as
        if(!playerData[socket.id].justJoined) socket.emit(msg);
    });
    tryStartRound();
    
}

app.get('/', function(req, res) {
    res.sendFile(root + '/public/homepage.html');
})

io.on('connection', (socket) => {
    sockets.push(socket);
    playerData[socket.id] = {};
    playerData[socket.id].justJoined = true;
    console.log(playerData[socket.id] + ', ' + socket.id + ' connected');
    socket.on('disconnect', ()=>{
        var index = -1;
        for(var i = 0; i < sockets.length; i ++) {
            if(sockets[i] == socket) {
                index = i;
            }
        }
        if(index != -1) {
            sockets.splice(index, 1);
        }
        if(sockets.length == 0) gameRunning = false;
    })
    socket.on('hit', () => {
        if(playerData[socket.id].justJoined && !playerData[socket.id].myTurn) {
            return;
        }
        if(playerData[socket.id].finishedHand) {
            return;
        }
        generateCard(socket);
    })
    socket.on('stand', () => {
        if(playerData[socket.id].justJoined && !playerData[socket.id].myTurn) {
            return;
        }
        playerData[socket.id].finishedHand = true;
        playerData[socket.id].myTurn = false;
        dealerLogic();
    })
    socket.on('double', () => {
        if(playerData[socket.id].justJoined && !playerData[socket.id].myTurn) {
            return;
        }
        if(playerData[socket.id].finishedHand) {
            return;
        }
        generateCard(socket);
        playerData[socket.id].finishedHand = true;
        dealerLogic();
    })
    socket.on('split', () => {
        if(playerData[socket.id].justJoined && !playerData[socket.id].myTurn) {
            return;
        }
    })
    if(sockets.length == 1) {
        playerData[socket.id].justJoined = false;
        tryStartRound();
    }
})

server.listen(port, function() {
    
});
run();