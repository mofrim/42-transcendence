import * as THREE from 'three';

export class RPS_Game {

    constructor (scene, player, players, renderer) {
        this.scene = scene;
        this.player = player;
        this.players = players;
        this.renderer = renderer;

        this.inRange = false;
        this.playerInRange = null;
        this.readyForRequest = true;
        this.battleRequestedPlayer = null;
        this.spritePlayer = this.makeSprite("", 20);

        this.minDist = Infinity;

        this.currentTextState = [];
        this.overlayScene = new THREE.Scene();
        this.overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.rpsSprite = new Map();

        this.rps_choiceMade = false;
        this.inBattleMode = false;
        this.inBattleChooseMode = false;

        this.yourChoice = null;
        this.opponentChoice = null;

        this.rpsSprite.set("Beam", this.addRPSSprite('textures/VS_Beam2.jpg', 10, 0.5));
        this.rpsSprite.get("Beam").position.set(0, -0.25, 0);

        this.rpsSprite.set("VS", this.addRPSSprite('textures/VS_2.png', 0.5, 0.5));
        this.rpsSprite.set("Draw", this.addRPSSprite('textures/Draw.png', 0.5, 0.5));
        this.rpsSprite.set("UserA", this.addRPSSprite('textures/UserA.png', 1, 1));
        this.rpsSprite.set("UserB", this.addRPSSprite('textures/UserB.png', 1, 1));

    }

    updateCheck() {
    
        this.minDist = Infinity;

        for(const [id, player] of this.players) {
            const dist = this.player.group.position.distanceToSquared(player.group.position);

            if(dist < 4){
                if(dist < this.minDist){
                    this.minDist = dist;
                    this.playerInRange = player;
                }
                //console.log("Player " + player.id + " is close! Distance: " + dist.toFixed(2));
                this.inRange = true;
            }
        }

        if(this.minDist === Infinity){
            this.inRange = false;
            this.playerInRange = null;
            if(this.spritePlayer)
                this.updateSpriteText(this.spritePlayer, "", 20);
        }
        else{
            const pos = this.playerInRange.group.position;

            this.updateSpriteText(this.spritePlayer,"Press B", 20);
            this.spritePlayer.position.set(pos.x, pos.y + 1.6, pos.z);
        }
    }

    BattleRequest(reqPlayerID){

        if(!this.player.youSendRPGRequest){
            this.removeText();
            this.addText(reqPlayerID, 0, -0.2, 50);
            this.addText("Rock Paper Scissors Battle Requested!", 0, -0.3, 100);
            this.addText("Y - Accept ", 0, -0.5, 100);
            this.addText("X - Decline", 0, -0.6, 100);
            this.battleRequestedPlayer = reqPlayerID;
            console.log("Battle requested: " + reqPlayerID);
        }

        
    }

    
    addRPSSprite(path, x, y) {
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

    async startRPSAnimation() {
        
        this.vsAnimationStart = false;

        this.inBattleMode = true;
        this.player.inRPSBattleMode = true;

        this.overlayScene.add(this.rpsSprite.get("UserA"));
        this.overlayScene.add(this.rpsSprite.get("UserB"));
        this.overlayScene.add(this.rpsSprite.get("VS"));
        this.overlayScene.add(this.rpsSprite.get("Beam"));

        const yp = 0.025;
        this.rpsSprite.get("UserA").position.set(0, yp, 0);
        this.rpsSprite.get("UserB").position.set(0, yp, 0);

        const loop = () => {
            const posA = this.rpsSprite.get("UserA").position.x;
            const posB = this.rpsSprite.get("UserB").position.x;

            this.rpsSprite.get("UserA").position.set(posA-0.005, yp, 0);
            this.rpsSprite.get("UserB").position.set(posB+0.005, yp, 0);

            if(posB < 0.75 && posA > -0.75) {
                requestAnimationFrame(loop);
            }
            else{
                this.overlayScene.remove(this.rpsSprite.get("UserA"));
                this.overlayScene.remove(this.rpsSprite.get("UserB"));
                this.overlayScene.remove(this.rpsSprite.get("VS"));
                this.overlayScene.remove(this.rpsSprite.get("Beam"));

                this.inGameRPSAnimation();

            }
        };
        loop();       
    }

    async inGameRPSAnimation() {
        
        this.vsAnimationStart = false;

        this.inBattleChooseMode = true;

        this.overlayScene.add(this.rpsSprite.get("UserA"));
        this.overlayScene.add(this.rpsSprite.get("Beam"));

        this.addText("1 - Rock!    ", -0.2, -0.1, 100);
        this.addText("2 - Paper!   ", 0, -0.25, 100);
        this.addText("3 - Scissors!", 0.2, -0.4, 100);

        const yp = 0.025;
        this.rpsSprite.get("UserA").position.set(-0.75, yp, 0);

        const loop = () => {
            const posA = this.rpsSprite.get("UserA").position.x;

            this.rpsSprite.get("UserA").position.set(posA+0.005, yp, 0);

            if(this.rps_choiceMade)
                this.removeText();

            if(posA < 0.75 ) {
                requestAnimationFrame(loop);
            }
            else{
                this.overlayScene.remove(this.rpsSprite.get("UserA"));
                this.overlayScene.remove(this.rpsSprite.get("Beam"));
                this.removeText();
                
                this.solutionRPSAnimation();
            }
        };
        loop();       
    }

    async solutionRPSAnimation() {

        this.overlayScene.add(this.rpsSprite.get("UserA"));
        this.overlayScene.add(this.rpsSprite.get("UserB"));
        this.overlayScene.add(this.rpsSprite.get("Beam"));

        const yp = 0.025;
        this.rpsSprite.get("UserA").position.set(0, yp, 0);
        this.rpsSprite.get("UserB").position.set(0, yp, 0);

        this.verifyRPSWinner();

        this.addText("You chose: " + this.yourChoice, -0.3, -0.1, 75);
        this.addText("Opponent chose: " + this.opponentChoice, 0.3, -0.35, 75);

        const loop = () => {
            const posA = this.rpsSprite.get("UserA").position.x;
            const posB = this.rpsSprite.get("UserB").position.x;

            this.rpsSprite.get("UserA").position.set(posA-0.003, yp, 0);
            this.rpsSprite.get("UserB").position.set(posB+0.003, yp, 0);

            if(posB < 0.75 && posA > -0.75) {
                requestAnimationFrame(loop);
            }
            else{
                this.overlayScene.remove(this.rpsSprite.get("UserA"));
                this.overlayScene.remove(this.rpsSprite.get("UserB"));
                this.overlayScene.remove(this.rpsSprite.get("Beam"));
                
                this.removeText();

                this.resetRPSGame();
            }
        };
        loop(); 
    }

    verifyRPSWinner() {

        if(this.yourChoice == null || this.opponentChoice == null){
            this.addText("Invalid Round...", 0, -0.225, 125);
            console.log("Choices not made yet!");
            return;
        }

        if(this.yourChoice === this.opponentChoice)
            this.addText("It's a draw!", 0, -0.225, 125);
        else if((this.yourChoice === "rock" && this.opponentChoice === "scissors") ||
                (this.yourChoice === "paper" && this.opponentChoice === "rock") ||
                (this.yourChoice === "scissors" && this.opponentChoice === "paper"))
            this.addText("You win!", 0, -0.225, 100); 
        else
            this.addText("You lose!", 0, -0.225, 100);

    }

    resetRPSGame() {
        this.rps_choiceMade = false;
        this.yourChoice = null;
        this.opponentChoice = null;
        this.inBattleMode = false;
        this.player.inRPSBattleMode = false;
        this.inBattleChooseMode = false;
        this.player.youSendRPGRequest = false;
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

    render() {

        this.onResize();
        this.renderer.render(this.overlayScene, this.overlayCamera);
    }

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
