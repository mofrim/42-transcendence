
export class GameManager {
    
    constructor() {
        this.players = new Map();
        this.tttGame = this.createTTTGame();
        this.rpsGame = new Map();


    }

    createPlayer(id){
        return {
            id: id,
            position: { x:0, y:0, z:0 },
            state: 'idle',
            gameID: 'none',
            inGame: false,
        };
    }

    removePlayer(id){
        if(this.players.has(id))
            this.players.delete(id);
    }

    getMapData(){
        return this.tttGame;
    }

    updatePlayer(id, x, y, z, state){

    }

    // Rock Paper Scissors Game ---------------------------------------------------------------------------

    createRPSGame(gameID, playerOne, playerTwo){
        return{
            gameID: gameID,
            playerOne: playerOne,
            playerTwo: playerTwo,
            playerOneChoice: "",
            playerTwoChoice: "",
            state: "requested", // requested, inGame
        }
    }

    removeRPSGame(gameID){
        if(!this.rpsGame.has(gameID))
            return;

        this.players.get(this.rpsGame.get(gameID).playerOne).gameID = "none";
        this.players.get(this.rpsGame.get(gameID).playerOne).inGame = false;
        this.players.get(this.rpsGame.get(gameID).playerTwo).gameID = "none";
        this.players.get(this.rpsGame.get(gameID).playerTwo).inGame = false;

        this.rpsGame.delete(gameID);
    }

    rpsRequested(data) {
    
        const playerRequested   = this.players.get(data.requestedPlayerID);
        const playerThis        = this.players.get(data.id);

        //console.log("RPS Game Requested: " + data.id + " requested player: " + data.requestedPlayerID);

        if(!playerRequested || !playerThis){
            console.log("One of the players not found for RPS game.");
            return 0;
        }
        if(playerRequested.inGame || playerThis.inGame){
            console.log("One of the players is already in a game: " + playerRequested.inGame + " " + playerThis.inGame + "  " + playerRequested.id + " " + playerThis.id);
            return 0;
        }

        const gameID = "rps_" + data.id + "_" + data.requestedPlayerID;
        const rpsGame = this.createRPSGame(gameID, data.id, data.requestedPlayerID);

        playerRequested.gameID = gameID;
        playerRequested.inGame = true;
        playerThis.gameID = gameID;
        playerThis.inGame = true;

        this.rpsGame.set(gameID, rpsGame);

        // RPS Game Requested
        return 1;

        /* //console.log("Marking 2: " + data.board);
        if(data.requestedPlayerID !== player.id)
            return 0;

        if(player.battleRequested){
            console.log("Player already in Request state, ignoring new request.");
            return 0;
        }

        player.battleRequested = true;
        rpsGame.BattleRequest(data.id);
        //console.log("You accepted a battle with player " + rpsGame.playerInRange.id); */
    }

    rpsDeclined(data){
        const playerThis = this.players.get(data.id);

        if(!playerThis)
            return 0;

        playerThis.gameID = "none";
        playerThis.inGame = false;

        const playerOther   = this.players.get(data.requestedPlayerID);
        if(playerOther){
            playerOther.gameID = "none";
            playerOther.inGame = false;
        }

        const rpsGame = this.rpsGame.get(playerThis.gameID);

        if(!rpsGame)
            return 0;

        rpsGame.delete(playerThis.gameID)

        return 1;
    }

    rpsAccept(data){
        const playerThis = this.players.get(data.id);
        const playerOther   = this.players.get(data.requestedPlayerID);
    
        if(!playerThis || !playerOther)
            return 0;

        const rpsGame = this.rpsGame.get(playerThis.gameID);

        if(!rpsGame)
            return 0;

        rpsGame.state = "inGame";
        return 1;
    }

    rpsChoice(data){
        const player = this.players.get(data.id);

        if(!player){
            console.log("Player not found for RPS choice.");
            return 0;
        }

        const rpsGame = this.rpsGame.get(player.gameID);
        //console.log("RPS GAMEID: " + player.gameID + "  Choice made : " + data.choice);
        if(!rpsGame){
            console.log("RPS game not found for player: " + player.id);
            return 0;
        }

        if(player.id === rpsGame.playerOne){
            rpsGame.playerOneChoice = data.choice;
        }
        else if(player.id === rpsGame.playerTwo){
            rpsGame.playerTwoChoice = data.choice;
        }
        else{
            console.log("Player not part of the RPS game: " + player.id);
            return 0;
        }

        return 1;
    }

    resultInvalid(playerOne, playerTwo){
        return {
            playerOne: playerOne,
            playerTwo: playerTwo,
        };
    }

    resultDraw(playerOne, playerTwo, choice){
        return {
            playerOne: playerOne,
            playerTwo: playerTwo,
            choice: choice,
        };
    }

    resultWinner(winner, winnerChoice, loser, loserChoice){
        return {
            winner: winner,
            winnerChoice: winnerChoice,
            loser: loser,
            loserChoice: loserChoice,
        };
    }

    verifyRPSGame(gameID){

        const rpsGame = this.rpsGame.get(gameID);

        if(!rpsGame){
            //console.log("RPS game not found for gameID: " + gameID);
            return 0;
        }

        if(rpsGame.playerOneChoice == null || rpsGame.playerTwoChoice == null){
            //console.log("Invalid Round. Choices not made yet!");
            return 1;
        }
        if(rpsGame.playerOneChoice === rpsGame.playerTwoChoice){
            //console.log("DRAW!");
            return 2;
        }
        else if((rpsGame.playerOneChoice === "rock" && rpsGame.playerTwoChoice === "scissors") ||
                (rpsGame.playerOneChoice === "paper" && rpsGame.playerTwoChoice === "rock") ||
                (rpsGame.playerOneChoice === "scissors" && rpsGame.playerTwoChoice === "paper")){
            //console.log("WINNER PLAYER ONE!");
            return 3;
        }
        else if((rpsGame.playerTwoChoice === "rock" && rpsGame.playerOneChoice === "scissors") ||
                (rpsGame.playerTwoChoice === "paper" && rpsGame.playerOneChoice === "rock") ||
                (rpsGame.playerTwoChoice === "scissors" && rpsGame.playerOneChoice === "paper")){
            //console.log("WINNER PLAYER TWO!");
            return 4;
        }

        return 0;
        /* if(PlayerOne.choice == null || PlayerTwo.choice == null){
            console.log("No Winner. Choices not made yet!");
            return 0;
        }
        if(rpsGame.playerOneChoice === rpsGame.playerTwoChoice)
            return this.resultDraw(PlayerOne, PlayerTwo, rpsGame.playerOneChoice);
        else if((rpsGame.playerOneChoice === "rock" && rpsGame.playerTwoChoice === "scissors") ||
                (rpsGame.playerOneChoice === "paper" && rpsGame.playerTwoChoice === "rock") ||
                (rpsGame.playerOneChoice === "scissors" && rpsGame.playerTwoChoice === "paper"))
                console.log("You win!"); */
                

    }

    // Tic Tac Toe Game -----------------------------------------------------------------------------------

    createTTTGame(){
        console.log("Creating new TTTGame.");
        return {
            players: [],

            // Names need to match the names of the board objects in the scene (Blender file)
            boardNames: [   "TTT_Board_1001", "TTT_Board_2001", "TTT_Board_3001",
                            "TTT_Board_4001", "TTT_Board_5001", "TTT_Board_6001",
                            "TTT_Board_7001", "TTT_Board_8001", "TTT_Board_9001" ],

            board: [    "", "", "",
                        "", "", "",
                        "", "", "" ],

            currentMark: "O",

            // 0: waiting for first player
            // 1: waiting for second player
            // 2: in game
            // 3: finished
            state: 0,
        };
    }

    startTTTGame(playerID){
        //console.log("Starting TTTGame for player: " + playerID);

        if(this.tttGame.state == 0 && this.tttGame.players.length == 0){
            console.log("Player 1 joined the game: " + playerID);
            this.tttGame.players.push(playerID);
            this.tttGame.state = 1;
            return 1;
        }
        else if(this.tttGame.state == 1 && this.tttGame.players.length == 1){
            if(this.tttGame.players[0] === playerID)
                return 0;
            console.log("Player 2 joined the game: " + playerID);
            this.tttGame.players.push(playerID);
            this.tttGame.state = 2;
            return 2;
        }
        else if(this.tttGame.state == 2 || this.tttGame.state == 3){
            //console.log("Game already in progress or finished. Player: " + playerID + " cannot join.");
            return 0;
        }

        console.log("Invalid TTTGame. Resetting game.");
        this.tttGame = this.createTTTGame();
        return -1;
    }

    tttMarkField(playerID, field){
        //console.log("Current Mark: " + this.tttGame.currentMark);
        if(this.tttGame.state !== 2) 
        {
            //console.log("Game not in progress. Cannot mark field.");
            return "none 1";
        }

        if(!this.tttGame.players.includes(playerID)){
            //console.log("Player not in the game." + playerID);
            return "none 2";
        }

        //console.log("In Marking: " + field + " by player: " + playerID);

        for(const box of this.tttGame.boardNames) {
            if(box === field) {
                //console.log("Marking now:" + field);

                const num = field.split("TTT_Board_")[1][0] - 1;

                if(this.tttGame.board[num] !== "") {
                    //console.log("Field already marked.");
                    return "none 3";
                }

                if(playerID === this.tttGame.players[0]){

                    if(this.tttGame.currentMark === "X"){
                        //console.log("Not your turn.");
                        return "none 4";
                    }

                    this.tttGame.currentMark = "X";
                    this.tttGame.board[num] = "X";

                    return "X";
                }
                else{

                    if(this.tttGame.currentMark === "O"){
                        return "none 5";
                    }

                    this.tttGame.currentMark = "O";
                    this.tttGame.board[num] = "O";
                    
                    return "O";
                }
            }
        }

        //console.log("Field not found.");
        return "none 6";
    }

    checkWin() {
        if(this.tttGame.board[0] === this.tttGame.board[1] && this.tttGame.board[1] === this.tttGame.board[2] && this.tttGame.board[0] !== ""){
            return 1;
        }
        if(this.tttGame.board[3] === this.tttGame.board[4] && this.tttGame.board[4] === this.tttGame.board[5] && this.tttGame.board[3] !== ""){
            return 2;
        }
        if(this.tttGame.board[6] === this.tttGame.board[7] && this.tttGame.board[7] === this.tttGame.board[8] && this.tttGame.board[6] !== ""){
            return 3;
        }

        if(this.tttGame.board[0] === this.tttGame.board[3] && this.tttGame.board[3] === this.tttGame.board[6] && this.tttGame.board[0] !== ""){
            return 4;
        }
        if(this.tttGame.board[1] === this.tttGame.board[4] && this.tttGame.board[4] === this.tttGame.board[7] && this.tttGame.board[1] !== ""){
            return 5;
        }
        if(this.tttGame.board[2] === this.tttGame.board[5] && this.tttGame.board[5] === this.tttGame.board[8] && this.tttGame.board[2] !== ""){
            return 6;
        }

        if(this.tttGame.board[0] === this.tttGame.board[4] && this.tttGame.board[4] === this.tttGame.board[8] && this.tttGame.board[0] !== ""){
            return 7;
        }
        if(this.tttGame.board[2] === this.tttGame.board[4] && this.tttGame.board[4] === this.tttGame.board[6] && this.tttGame.board[2] !== ""){
            return 8;
        }

        return 0;
    }

    checkDraw() {
        for (const field of this.tttGame.board) {
            if(field === "")
            {
                //console.log("Not finished yet");
                return false;
            }
        }
        console.log("No Winner :(");
        //this.updateSpriteText(this.spriteGameText, "No Winner");
        return true;
    }

}