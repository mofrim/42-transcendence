import * as THREE from 'three';

export class TTT_Game {

    constructor (scene, player, board, button, renderer) {
        this.board = board;
        this.scene = scene;
        this.button = button;
        this.renderer = renderer;
        this.renderer.autoClear = false;
        this.player = player;
        this.players = [];
        /* this.state = [  "", "", "",
                        "", "", "",
                        "", "", "" ]; */

        //this.gameStarted = false;
        //this.gameEnded = false;

        this.tttCamera = false;

        this.vsAnimationStart = false;

        //this.currentMark = "O";

        this.spritePlayer1 = null;
        this.spritePlayer2 = null;
        this.spritePlayer1_Name = null;
        this.spritePlayer2_Name = null;
        this.spritePlayer1_Text = null;
        this.spritePlayer2_Text = null;

        this.spriteGameText = null;
        this.spriteGameCount = null;

        //this.currentTextState = null;
        this.currentTextState = [];

        this.texX = new THREE.TextureLoader().load('textures/X.jpg');
        this.texO = new THREE.TextureLoader().load('textures/O.jpg');
        this.texEmpty = new THREE.TextureLoader().load('textures/Empty.jpg');

        this.overlayScene = new THREE.Scene();
        this.overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.vsSprite = new Map();

        //this.vsSprite.set("A", this.addVSSprite('textures/X.jpg'));
        this.vsSprite.set("Beam", this.addVSSprite('textures/VS_Beam2.jpg', 10, 0.5));
        this.vsSprite.get("Beam").position.set(0, -0.25, 0);

        this.vsSprite.set("VS", this.addVSSprite('textures/VS_2.png', 0.5, 0.5));
        this.vsSprite.set("Draw", this.addVSSprite('textures/Draw.png', 0.5, 0.5));
        this.vsSprite.set("UserA", this.addVSSprite('textures/UserA.png', 1, 1));
        this.vsSprite.set("UserB", this.addVSSprite('textures/UserB.png', 1, 1));

        //this.pos += 0.01;
        //this.startVSAnimation();
        //this.addText("Tic Tac Toe", -0.5);
        this.initSpriteText();
        console.log("TTT Game initialized.");
    }

    initGame(data){

        if(data.players[0]){
            this.updateSpriteText(this.spriteGameCount, "1/2", 50);
            this.players[0] = data.players[0];
        }
        if(data.players[1]){
            this.updateSpriteText(this.spriteGameCount, "2/2", 50);
            this.updateSpriteText(this.spriteGameText, "IN GAME", 50);
            this.players[1] = data.players[1];
        }

        this.waitforInitMesh(data);

    }

    async waitforInitMesh(data) {
        const loop = () => {
            //console.log("Waiting for board to be ready...");
            this.wait(10);
            if(!this.board[0]) {
                requestAnimationFrame(loop);
            }
            else{
                let index = 0;
                for(const box of data.board) {
                    if(box == "X")
                        this.board[index].material.map = this.texX;
                    else if(box == "O")
                        this.board[index].material.map = this.texO;
                    index++;
                    //console.log("# Initializing board: " + box);
                }
            }
        };
        loop();    
    }

    addVSSprite(path, x, y) {
        const texture = new THREE.TextureLoader().load(path);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        const geometry = new THREE.PlaneGeometry(x, y);
        let mesh = new THREE.Mesh(geometry, material);
        //this.overlayScene.add(mesh);
        
        return mesh;
    }

    onResize() {

        const aspect = window.innerWidth / window.innerHeight;

        this.overlayCamera.left = -aspect;
        this.overlayCamera.right = aspect;
        this.overlayCamera.top = 1;
        this.overlayCamera.bottom = -1;

        this.overlayCamera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /* addText(text, py) {
        this.currentTextState = this.makeSprite(text, 50);
        const scaleFactor = 0.2;
        this.currentTextState.scale.set(this.currentTextState.scale.x * scaleFactor, this.currentTextState.scale.y * scaleFactor, 1);
        this.currentTextState.position.set(0, py, 0);
        //console.log("Adding text: " + this.currentTextState.scale.x + ", " + this.currentTextState.scale.y + ", " + this.currentTextState.scale.z);
        this.overlayScene.add(this.currentTextState);
    }

    removeText() {
        if(this.currentTextState) {
            this.overlayScene.remove(this.currentTextState);
            this.currentTextState = null;
        }
    } */


    async startVSAnimation() {
        
        this.removeText();
        this.vsAnimationStart = false;

        this.overlayScene.add(this.vsSprite.get("UserA"));
        this.overlayScene.add(this.vsSprite.get("UserB"));
        this.overlayScene.add(this.vsSprite.get("VS"));
        this.overlayScene.add(this.vsSprite.get("Beam"));

        const yp = 0.025;
        this.vsSprite.get("UserA").position.set(0, yp, 0);
        this.vsSprite.get("UserB").position.set(0, yp, 0);

        const loop = () => {
            const posA = this.vsSprite.get("UserA").position.x;
            const posB = this.vsSprite.get("UserB").position.x;

            this.vsSprite.get("UserA").position.set(posA+0.005, yp, 0);
            this.vsSprite.get("UserB").position.set(posB-0.005, yp, 0);

            if(posA < 0.75 && posB > -0.75) {
                requestAnimationFrame(loop);
            }
            else{
                this.overlayScene.remove(this.vsSprite.get("UserA"));
                this.overlayScene.remove(this.vsSprite.get("UserB"));
                this.overlayScene.remove(this.vsSprite.get("VS"));
                this.overlayScene.remove(this.vsSprite.get("Beam"));

                this.removeText();
                if(this.player.id === this.players[0]){
                    this.addText("You are \"X\". You go first", 0, -0.5, 75);
                }
                else{
                    this.addText("You are \"O\". You go second", 0, -0.5, 75);
                }

                this.tttCamera = true;

            }
        };
        loop();       
    }

    async winAnimation(user) {
        
        this.vsAnimationStart = false;
        console.log("Animating win...");

        this.overlayScene.add(this.vsSprite.get(user));
        this.overlayScene.add(this.vsSprite.get("Beam"));

        const yp = 0.025;
        this.vsSprite.get(user).position.set(-0.75, yp, 0);

        const loop = () => {
            const posA = this.vsSprite.get(user).position.x;

            this.vsSprite.get(user).position.set(posA+0.003, yp, 0);

            if(posA < 0) {
                requestAnimationFrame(loop);
            }
            else{
                this.removeText();

                //console.log("Animation finished.");
                this.overlayScene.remove(this.vsSprite.get(user));
                this.overlayScene.remove(this.vsSprite.get("Beam"));

                this.overlayScene.remove(this.spriteGameText);

                //this.endGame();
                this.tttCamera = false;
            }
        };
        loop();       
    }

    async drawAnimation() {
        
        this.vsAnimationStart = false;
        console.log("Animating Draw...");

        this.overlayScene.add(this.vsSprite.get("Draw"));
        this.overlayScene.add(this.vsSprite.get("Beam"));

        this.vsSprite.get("Draw").scale.set(0.5, 0.5, 0);
         this.vsSprite.get("Draw").position.set(0,-0.2, 0);

        const loop = () => {
            const scaleX = this.vsSprite.get("Draw").scale.x;

            this.vsSprite.get("Draw").scale.set(scaleX+0.015, scaleX+0.015, 1);

            if(scaleX < 2) {
                requestAnimationFrame(loop);
            }
            else{
                this.removeText();

                //console.log("Animation finished.");
                this.overlayScene.remove(this.vsSprite.get("Draw"));
                this.overlayScene.remove(this.vsSprite.get("Beam"));

                this.overlayScene.remove(this.spriteGameText);

                this.tttCamera = false;
                //this.endGame();
            }
        };
        loop();       
    }

    render() {

        this.onResize();

        if(this.vsAnimationStart){
            this.startVSAnimation();
        }


        /* 
        this.pos += 0.01;
        for(const [id, player] of this.vsSprite) {
            //player.position.set(Math.sin(this.pos) * 0.5, Math.cos(this.pos) * 0.5, 0);
            console.log("ID: "+id+" Position: "+player.position.x);
        } */

        //this.quad.position.set(Math.sin(this.pos) * 0.5, Math.cos(this.pos) * 0.5, 0);
        this.renderer.render(this.overlayScene, this.overlayCamera);
    }

    /* makeSpriteImage(img, sx, sy) {

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = 512;
        canvas.height = 128;

        // draw image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 128, 0, canvas.width, canvas.height);

        const texture = new THREE.CanvasTexture(canvas);

        const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: texture })
        );

        sprite.scale.set(sx, sy, 1);

        this.scene.add(sprite);

        return sprite;
    } */

    /* makeSprite(text, size) {

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = 2048;
        canvas.height = 128;
        

        ctx.font = size+'px Segoe UI Black';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.lineWidth = 8;          // outline thickness
        ctx.strokeStyle = 'black';  // outline color
        ctx.strokeText(text, canvas.width / 2, canvas.height / 2);

        ctx.fillStyle = 'white';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set((canvas.width / canvas.height), 1, 1);

        //sprite.renderOrder = 999;
        //material.depthTest = false;
        //material.depthWrite = false;

        this.scene.add(sprite);

        return sprite;
    } */

    /* updateSpriteText(sprite, text, size) {
        const canvas = sprite.material.map.image;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = size+'px Segoe UI Black';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.lineWidth = 8;          // outline thickness
        ctx.strokeStyle = 'black';  // outline color
        ctx.strokeText(text, canvas.width / 2, canvas.height / 2);

        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        sprite.material.map.needsUpdate = true;
    } */

    initSpriteText() {

        /* const img = new Image();
        img.onload = () => {
            this.spriteGameText = this.makeSpriteImage(img, 1, 1);
            this.spriteGameText.position.set(23.23, 5.5, -13.51);
        };
        img.src = 'textures/X.jpg'; */

        this.spriteGameText = this.makeSprite("Click to Join", 50);
        this.spriteGameCount = this.makeSprite("0/2", 50);
        this.spriteGameText.position.set(24.25, 5.5, -16.13);
        this.spriteGameCount.position.set(24.25, 5.2, -16.13);

        /* this.spritePlayer1 = this.makeSprite("Player X", 25);
        this.spritePlayer2 = this.makeSprite("Player O", 25);
        this.spritePlayer1.position.set(18.2, 4, -16.35);
        this.spritePlayer2.position.set(23.77, 4, -16.11); */

        /* this.spritePlayer1_Name = this.makeSprite("", 20);
        this.spritePlayer2_Name = this.makeSprite("", 20);
        this.spritePlayer1_Name.position.set(18.2, 4.4, -16.35);
        this.spritePlayer2_Name.position.set(23.77, 4.4, -16.11); */

        /* this.spritePlayer1_Text = this.makeSprite("", 30);
        this.spritePlayer2_Text = this.makeSprite("", 30);
        this.spritePlayer1_Text.position.set(18.2, 5.0, -16.35);
        this.spritePlayer2_Text.position.set(23.77, 5.0, -16.11); */

    }

    setPlayerOne(playerID){
        this.players[0] = playerID;
        console.log("First Player added to game." + playerID);
        this.updateSpriteText(this.spriteGameCount, "1/2", 50);
        if(this.player.id === playerID)
            this.addText("You joined the game. Waiting for another player...", 0, -0.5, 75);
    }

    setPlayerTwo(playerID){
        console.log("Second Player added to game." + playerID);
        this.players[1] = playerID;
    }

    startGame(playerOne, playerTwo) {

        if(playerOne !== this.players[0] || playerTwo !== this.players[1]){
            console.log("Player IDs do not match. Cannot start game.");
            return;
        }

        this.clearBoard();
        console.log("TTT GAME START!!!");
        console.log("Player 1: " + this.players[0]);
        console.log("Player 2: " + this.players[1]);
        this.updateSpriteText(this.spriteGameCount, "2/2", 50);
        this.updateSpriteText(this.spriteGameText, "IN GAME", 50);
        //this.gameStarted = true;

        if(this.player.id !== playerOne && this.player.id !== playerTwo)
            return;

        this.startVSAnimation();

/*         if(this.gameStarted)
            return;

        if(this.players.length == 0) {
            console.log("Player added to game." + playerID);
            this.updateSpriteText(this.spriteGameCount, "1/2", 25);
            if(this.player.id === playerID)
                this.addText("You joined the game. Waiting for another player...", -0.5);
            //this.updateSpriteText(this.spritePlayer1_Name, playerID, 20);
            this.players.push(playerID);
            return;
        }

        if(this.players.length == 1) {
            if(!this.players.includes(playerID)){
                console.log("Player added to game." + playerID);
                this.updateSpriteText(this.spriteGameCount, "2/2", 25);
                //this.updateSpriteText(this.spritePlayer2_Name, playerID, 20);
                this.players.push(playerID);
            }
            else{
                console.log("Player already in the game." + playerID);
                return;
            }
        } */


        /* this.updateSpriteText(this.spritePlayer1_Text, "Click to Start", 30);
        this.updateSpriteText(this.spritePlayer2_Text, "Click to Start", 30); */
        
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async endGame() {
        await this.wait(2000);
        this.clearBoard();
        
        console.log("TTT GAME END!!!");
        
        //this.gameStarted = false;
        //this.gameEnded = false;
        
        this.tttCamera = false;

        this.currentMark = "O";
        this.updateSpriteText(this.spriteGameText, "Click to Join", 50);
        this.updateSpriteText(this.spriteGameCount, "0/2", 50);

        if(this.players.includes(this.player.id))
            this.removeText();
        this.players = [];
        for (const box of this.board) 
            box.material.color = new THREE.Color(0xffffff);
        
        /* this.updateSpriteText(this.spritePlayer1,"Player X", 25);
        this.updateSpriteText(this.spritePlayer2,"Player O", 25);
        this.updateSpriteText(this.spritePlayer1_Name, "", 20);
        this.updateSpriteText(this.spritePlayer2_Name, "", 20);
        this.updateSpriteText(this.spritePlayer1_Text, "", 30);
        this.updateSpriteText(this.spritePlayer2_Text, "", 30); */
    }

    clearBoard() {
        for(const box of this.board) {
            box.material.map = this.texEmpty;
            box.material.needsUpdate = true;
        }

        this.state = [  "", "", "",
                        "", "", "",
                        "", "", "" ];
    }

    drawWin(winner) {
        if(winner == 1){
            this.board[0].material.color = new THREE.Color(0xff0000);
            this.board[1].material.color = new THREE.Color(0xff0000);
            this.board[2].material.color = new THREE.Color(0xff0000);
        }
        else if(winner == 2){
            this.board[3].material.color = new THREE.Color(0xff0000);
            this.board[4].material.color = new THREE.Color(0xff0000);
            this.board[5].material.color = new THREE.Color(0xff0000);
        }
        else if(winner == 3){
            this.board[6].material.color = new THREE.Color(0xff0000);
            this.board[7].material.color = new THREE.Color(0xff0000);
            this.board[8].material.color = new THREE.Color(0xff0000);
        }
        else if(winner == 4){
            this.board[0].material.color = new THREE.Color(0xff0000);
            this.board[3].material.color = new THREE.Color(0xff0000);
            this.board[6].material.color = new THREE.Color(0xff0000);
        }
        else if(winner == 5){
            this.board[1].material.color = new THREE.Color(0xff0000);
            this.board[4].material.color = new THREE.Color(0xff0000);
            this.board[7].material.color = new THREE.Color(0xff0000);
        }
        else if(winner == 6){
            this.board[2].material.color = new THREE.Color(0xff0000);
            this.board[5].material.color = new THREE.Color(0xff0000);
            this.board[8].material.color = new THREE.Color(0xff0000);
        }
        else if(winner == 7){
            this.board[0].material.color = new THREE.Color(0xff0000);
            this.board[4].material.color = new THREE.Color(0xff0000);
            this.board[8].material.color = new THREE.Color(0xff0000);
        }
        else if(winner == 8){
            this.board[2].material.color = new THREE.Color(0xff0000);
            this.board[4].material.color = new THREE.Color(0xff0000);
            this.board[6].material.color = new THREE.Color(0xff0000);
        }
    }

    winner(playerID) {
        if(this.players.includes(this.player.id)){
            this.removeText();
            this.updateSpriteText(this.spriteGameText, "FINISH", 50);

            if(this.player.id === playerID){
                this.winAnimation("UserA");
                this.addText("You Win!", 0, -0.5, 75);
            }
            else{
                this.winAnimation("UserB");
                this.addText("Player " + playerID + " is the winner...", 0, -0.5, 75);
            }
            
            console.log("Player 1 wins!");
        }
    }

    draw() {
        this.removeText();
        this.drawAnimation();
        this.updateSpriteText(this.spriteGameText, "FINISH", 50); 
    }

    checkDraw() {
        for (const field of this.state) {
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

    markField(fieldName, playerID, mark) {

        console.log("In Marking: " + fieldName + " by player: " + playerID);
        /* if(!this.gameStarted){
            console.log("Game not started yet.");
            return;
        } */

        if(this.players.includes(this.player.id)){
            this.removeText();

            if(this.player.id === this.players[0] && mark === "X")
                this.addText("Waiting...", 0, -0.5, 75);
            else if(this.player.id === this.players[0] && mark === "O")
                this.addText("Your Turn with X!", 0, -0.5, 75);

            if(this.player.id === this.players[1] && mark === "O")
                this.addText("Waiting...", 0, -0.5, 75);
            else if(this.player.id === this.players[1] && mark === "X")
                this.addText("Your Turn with O!", 0, -0.5, 75);
        }

        for(const box of this.board) {
            if(box.name === fieldName) {
                //console.log("Marking now:" + fieldName);
                if(mark === "O")
                    box.material.map = this.texO;
                else
                    box.material.map = this.texX;
                box.material.needsUpdate = true;
            }
        }
    }


/*     markField(obj, playerID) {

        if(!this.gameStarted){
            console.log("Game not started yet." + playerID);
            return;
        }

        if(!this.players.includes(playerID)){
            console.log("Player not in the game." + playerID);
            return;
        }

        for(const box of this.board) {
            if(box.name === obj) {
                console.log("Marking now:" + obj);

                const num = obj.split("TTT_Board_")[1][0] - 1;

                if(this.state[num] !== "") {
                    console.log("Field already marked.");
                    return;
                }

                if(playerID === this.players[0]){

                    if(this.currentMark === "X"){
                        console.log("Not your turn.");
                        return;
                    }

                    this.currentMark = "X";
                    this.state[num] = "X";
                    box.material.map = this.texX;

                    this.removeText();
                    if(this.player.id === playerID)
                        this.addText("Waiting...", -0.5);
                    else
                        this.addText("Your Turn with O!", -0.5);
                
                    const checkWin = this.verifyWin();
                    if(checkWin !== null) {

                        //this.gameEnded = true;

                        this.removeText();
                        this.updateSpriteText(this.spriteGameText, "FINISH", 25);

                        if(this.player.id === playerID){
                            this.winAnimation("UserA");
                            this.addText("You Win!", -0.5);
                        }
                        else{
                            this.winAnimation("UserB");
                            this.addText("Player " + playerID + " is the winner...", -0.5);
                        }
                        
                        console.log("Player 1 wins!");
                        return;
                    }

                }
                else{

                    if(this.currentMark === "O"){
                        console.log("Not your turn.");
                        return;
                    }

                    this.currentMark = "O";
                    this.state[num] = "O";
                    box.material.map = this.texO;
                    
                    this.removeText();
                    if(this.player.id === playerID)
                        this.addText("Waiting...", -0.5);
                    else
                        this.addText("Your Turn with X!", -0.5);

                    const checkWin = this.verifyWin();
                    if(checkWin !== null) {

                        //this.gameEnded = true;

                        this.removeText();
                        this.updateSpriteText(this.spriteGameText, "FINISH", 25);
                        
                        if(this.player.id === playerID){
                            this.winAnimation("UserA");
                            this.addText("You Win!", -0.5);
                        }
                        else{
                            this.winAnimation("UserB");
                            this.addText("Player " + playerID + " is the winner...", -0.5);
                        }

                        console.log("Player 2 wins!");
                        return;
                    }

                }

                box.material.needsUpdate = true;

                if(this.checkDraw()){
                    this.removeText();
                    this.drawAnimation();
                    this.updateSpriteText(this.spriteGameText, "FINISH", 25);
                }

                return;
            }
        }
    } */


/*     markField(obj, playerID) {

        if(!this.gameStarted) 
            return;

        if(this.gameEnded)
            return;

        if(!this.players.includes(playerID)){
            console.log("Player not in the game." + playerID);
            return;
        }

        console.log("In Marking: " + obj + " by player: " + playerID);

        for(const box of this.board) {
            if(box.name === obj) {
                console.log("Marking now:" + obj);

                const num = obj.split("TTT_Board_")[1][0] - 1;

                if(this.state[num] !== "") {
                    console.log("Field already marked.");
                    return;
                }

                if(playerID === this.players[0]){

                    if(this.currentMark === "X"){
                        console.log("Not your turn.");
                        return;
                    }

                    this.currentMark = "X";
                    this.state[num] = "X";
                    box.material.map = this.texX;

                    this.removeText();
                    if(this.player.id === playerID)
                        this.addText("Waiting...", -0.5);
                    else
                        this.addText("Your Turn with O!", -0.5);
                
                    const checkWin = this.verifyWin();
                    if(checkWin !== null) {

                        this.gameEnded = true;

                        this.removeText();
                        this.updateSpriteText(this.spriteGameText, "FINISH", 25);

                        if(this.player.id === playerID){
                            this.winAnimation("UserA");
                            this.addText("You Win!", -0.5);
                        }
                        else{
                            this.winAnimation("UserB");
                            this.addText("Player " + playerID + " is the winner...", -0.5);
                        }
                        
                        //
                        console.log("Player 1 wins!");
                        //this.updateSpriteText(this.spritePlayer1_Text, "You Win!", 30);
                        //this.updateSpriteText(this.spritePlayer2_Text, "You Lose!", 30);
                        

                        //this.endGame();
                        return;
                    }

                    //this.updateSpriteText(this.spritePlayer1_Text, "Waiting...", 30);
                    //this.updateSpriteText(this.spritePlayer2_Text, "Your Turn!", 30);

                }
                else{

                    if(this.currentMark === "O"){
                        console.log("Not your turn.");
                        return;
                    }

                    this.currentMark = "O";
                    this.state[num] = "O";
                    box.material.map = this.texO;
                    
                    this.removeText();
                    if(this.player.id === playerID)
                        this.addText("Waiting...", -0.5);
                    else
                        this.addText("Your Turn with X!", -0.5);

                    const checkWin = this.verifyWin();
                    if(checkWin !== null) {

                        this.gameEnded = true;

                        this.removeText();
                        this.updateSpriteText(this.spriteGameText, "FINISH", 25);
                        
                        if(this.player.id === playerID){
                            this.winAnimation("UserA");
                            this.addText("You Win!", -0.5);
                        }
                        else{
                            this.winAnimation("UserB");
                            this.addText("Player " + playerID + " is the winner...", -0.5);
                        }

                        //this.gameEnded = true;
                        console.log("Player 2 wins!");
                        //this.updateSpriteText(this.spritePlayer1_Text, "You Lose!", 30);
                        //this.updateSpriteText(this.spritePlayer2_Text, "You Win!", 30); 
                        
                        
                        //this.endGame();
                        return;
                    }
                    
                    //this.updateSpriteText(this.spritePlayer1_Text, "Your Turn!", 30);
                    this.updateSpriteText(this.spritePlayer2_Text, "Waiting...", 30); 

                }

                box.material.needsUpdate = true;

                //box.material.color.set(0xff0000);
                if(this.checkDraw()){
                    this.removeText();
                    this.drawAnimation();
                    this.updateSpriteText(this.spriteGameText, "FINISH", 25);
                    //this.updateSpriteText(this.spritePlayer1_Text, "DRAW", 30);
                    //this.updateSpriteText(this.spritePlayer2_Text, "DRAW", 30);

                    //this.endGame();
                }

                return;
            }
        }
    } */


    addText(text, px, py, size) {
        this.currentTextState.push(this.makeSprite(text, size));
        const scaleFactor = 0.2;
        this.currentTextState[this.currentTextState.length - 1].scale.set(this.currentTextState[this.currentTextState.length - 1].scale.x * scaleFactor, this.currentTextState[this.currentTextState.length - 1].scale.y * scaleFactor, 1);
        this.currentTextState[this.currentTextState.length - 1].position.set(px, py, 0);
        //console.log("Adding text: " + this.currentTextState[this.currentTextState.length - 1].scale.x + ", " + this.currentTextState[this.currentTextState.length - 1].scale.y + ", " + this.currentTextState[this.currentTextState.length - 1].scale.z);
        this.overlayScene.add(this.currentTextState[this.currentTextState.length - 1]);
    }

    removeText() {
        if(this.currentTextState) {
            this.currentTextState.forEach((textSprite) => {
                this.overlayScene.remove(textSprite);
            });
            this.currentTextState = [];
        }
    }

    makeSprite(text, size) {

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = 2048;
        canvas.height = 256;
        

        ctx.font = size+'px Segoe UI Black';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.lineWidth = 8;          // outline thickness
        ctx.strokeStyle = 'black';  // outline color
        ctx.strokeText(text, canvas.width / 2, canvas.height / 2);

        ctx.fillStyle = 'white';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        material.transparent = true;
        material.depthWrite = false;
        material.depthTest = true;
        const sprite = new THREE.Sprite(material);
        sprite.scale.set((canvas.width / canvas.height), 1, 1);


        this.scene.add(sprite);

        return sprite;
    }

    updateSpriteText(sprite, text, size) {
        const canvas = sprite.material.map.image;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = size+'px Segoe UI Black';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.lineWidth = 8;          // outline thickness
        ctx.strokeStyle = 'black';  // outline color
        ctx.strokeText(text, canvas.width / 2, canvas.height / 2);

        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        sprite.material.map.needsUpdate = true;
    }

}
