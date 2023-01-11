import { Client, Room } from "colyseus.js";
import {
    ITable,
    ITownState,
    IPlayer,
    // IWhiteboard,
} from "../types/ITownState";
import { Message } from "../types/Messages";
import { IRoomData, RoomType } from "../types/Rooms";
import { ItemType } from "../types/Items";
import WebRTC from "../web/WebRTC";
import { phaserEvents, Event } from "../events/EventCenter";
import store from "../stores";
import {
    setSessionId,
    setPlayerNameMap,
    removePlayerNameMap,
} from "../stores/UserStore";
import {
    setLobbyJoined,
    setJoinedRoomData,
    setNumPlayer,
} from "../stores/RoomStore";
import {
    pushChatMessage,
    pushPlayerJoinedMessage,
    pushPlayerLeftMessage,
} from "../stores/ChatStore";


export default class Network {
    private client: Client;
    private room?: Room<ITownState>;
    private lobby!: Room;
    webRTC?: WebRTC;

    mySessionId!: string;
    myUserId!: string;

    constructor() {
        /*로컬 서버 접속*/
        const protocol = window.location.protocol.replace("http", "ws");
        const endpoint =
            process.env.NODE_ENV === "production"
                ? import.meta.env.VITE_SERVER_URL
                : `${protocol}//${window.location.hostname}:2567`;

        /*배포 서버 접속*/
        // const endpoint = "wss://momstown.herokuapp.com/";

        this.client = new Client(endpoint);
    
        this.joinLobbyRoom().then(() => {
            store.dispatch(setLobbyJoined(true));
        });

        phaserEvents.on(
            Event.MY_PLAYER_NAME_CHANGE,
            this.updatePlayerName,
            this
        );
        phaserEvents.on(
            Event.MY_PLAYER_TEXTURE_CHANGE,
            this.updatePlayer,
            this
        );
        phaserEvents.on(
            Event.PLAYER_DISCONNECTED,
            this.playerStreamDisconnect,
            this
        );
    }

    /**
     * method to join Colyseus' built-in LobbyRoom, which automatically notifies
     * connected clients whenever rooms with "realtime listing" have updates
     */
    async joinLobbyRoom() {
        this.lobby = await this.client.joinOrCreate(RoomType.LOBBY);
    }


    // method to join the public lobby
    async joinOrCreatePublic(userId: string) {
        this.room = await this.client.joinOrCreate(RoomType.PUBLIC);
        this.myUserId = userId;
        this.initialize();
    }

    // method to join a custom room
    async joinCustomById(roomId: string, password: string | null) {
        this.room = await this.client.joinById(roomId, { password });
        this.initialize();
    }

    // method to create a custom room
    async createCustom(roomData: IRoomData) {
        const { name, description, password, autoDispose } = roomData;
        this.room = await this.client.create(RoomType.CUSTOM, {
            name,
            description,
            password,
            autoDispose,
        });
        this.initialize();
    }

    // set up all network listeners before the game starts
    initialize() {
        if (!this.room) return;

        this.lobby.leave();
        this.mySessionId = this.room.sessionId;
        console.log("mySessionId", this.mySessionId);
        console.log("myUserId", this.myUserId);
        store.dispatch(setSessionId(this.room.sessionId));
        this.webRTC = new WebRTC(this.mySessionId, this);

        // new instance added to the players MapSchema
        this.room.state.players.onAdd = (player: IPlayer, key: string) => {
            if (key === this.mySessionId) return;

            // track changes on every child object inside the players MapSchema
            player.onChange = (changes) => {
                changes.forEach((change) => {
                    const { field, value } = change;
                    phaserEvents.emit(Event.PLAYER_UPDATED, field, value, key);

                    // when a new player finished setting up player name
                    if (field === "name" && value !== "") {
                        phaserEvents.emit(Event.PLAYER_JOINED, player, key);
                        store.dispatch(
                            // 테스트 myUserId 와 sessionId 매핑
                            setPlayerNameMap({ id: key, name: value, userId: this.myUserId })
                        );
                        store.dispatch(pushPlayerJoinedMessage(value));
                    }
                });
            };
        };

        // an instance removed from the players MapSchema
        this.room.state.players.onRemove = (player: IPlayer, key: string) => {
            phaserEvents.emit(Event.PLAYER_LEFT, key);
            this.webRTC?.deleteVideoStream(key);
            this.webRTC?.deleteOnCalledVideoStream(key);
            store.dispatch(pushPlayerLeftMessage(player.name));
            store.dispatch(removePlayerNameMap(key));
        };

        this.room.state.tables.onAdd = (table: ITable, key: string) => {
            // track changes on every child object's connectedUser
            table.connectedUser.onAdd = (item, index) => {
                phaserEvents.emit(
                    Event.ITEM_USER_ADDED,
                    item,
                    key,
                    ItemType.CHAIR
                );
            };
            table.connectedUser.onRemove = (item, index) => {
                phaserEvents.emit(
                    Event.ITEM_USER_REMOVED,
                    item,
                    key,
                    ItemType.CHAIR
                );
            };
        };

        // new instance added to the chatMessages ArraySchema
        this.room.state.chatMessages.onAdd = (item, index) => {
            store.dispatch(pushChatMessage(item));
        };

        // when the server sends room data
        this.room.onMessage(Message.SEND_ROOM_DATA, (content) => {
            store.dispatch(setJoinedRoomData(content));
        });

        // when a user sends a message
        this.room.onMessage(
            Message.ADD_CHAT_MESSAGE,
            ({ clientId, content }) => {
                phaserEvents.emit(
                    Event.UPDATE_DIALOG_BUBBLE,
                    clientId,
                    content
                );
            }
        );

        // when a peer disconnects with myPeer
        this.room.onMessage(Message.DISCONNECT_STREAM, (clientId: string) => {
            this.webRTC?.deleteOnCalledVideoStream(clientId);
        });
        this.room.onMessage(Message.STOP_TABLE_TALK, (clientId: string) => {
            const tableState = store.getState().table;
            tableState.tableTalkManager?.onUserLeft(clientId);
        });
        this.room.onMessage(Message.RECEIVE_DM, (content) => {
            console.log(content);
        })
        this.room.onStateChange((state) => {
            const playerSize = this.room?.state.players.size;
            if (playerSize === undefined) return;
            let numPlayers: number = playerSize;
            store.dispatch(setNumPlayer(numPlayers));
          });
    }
    getChairState() {
        return this.room?.state.chairs;
    }
    getPlayersIds(){
        return this.room?.state.players;
    }
    // method to register event listener and call back function when a item user added
    onChatMessageAdded(
        callback: (playerId: string, content: string) => void,
        context?: any
    ) {
        phaserEvents.on(Event.UPDATE_DIALOG_BUBBLE, callback, context);
    }

    // method to register event listener and call back function when a item user added
    onItemUserAdded(
        callback: (playerId: string, key: string, itemType: ItemType) => void,
        context?: any
    ) {
        phaserEvents.on(Event.ITEM_USER_ADDED, callback, context);
    }

    // method to register event listener and call back function when a item user removed
    onItemUserRemoved(
        callback: (playerId: string, key: string, itemType: ItemType) => void,
        context?: any
    ) {
        phaserEvents.on(Event.ITEM_USER_REMOVED, callback, context);
    }

    // method to register event listener and call back function when a player joined
    onPlayerJoined(
        callback: (Player: IPlayer, key: string) => void,
        context?: any
    ) {
        phaserEvents.on(Event.PLAYER_JOINED, callback, context);
    }

    // method to register event listener and call back function when a player left
    onPlayerLeft(callback: (key: string) => void, context?: any) {
        phaserEvents.on(Event.PLAYER_LEFT, callback, context);
    }

    // method to register event listener and call back function when myPlayer is ready to connect
    onMyPlayerReady(callback: (key: string) => void, context?: any) {
        phaserEvents.on(Event.MY_PLAYER_READY, callback, context);
    }

    // method to register event listener and call back function when my video is connected
    onMyPlayerVideoConnected(callback: (key: string) => void, context?: any) {
        phaserEvents.on(Event.MY_PLAYER_VIDEO_CONNECTED, callback, context);
    }

    // method to register event listener and call back function when a player updated
    onPlayerUpdated(
        callback: (field: string, value: number | string, key: string) => void,
        context?: any
    ) {
        phaserEvents.on(Event.PLAYER_UPDATED, callback, context);
    }

    // method to send player updates to Colyseus server
    updatePlayer(currentX: number, currentY: number, currentAnim: string) {
        this.room?.send(Message.UPDATE_PLAYER, {
            x: currentX,
            y: currentY,
            anim: currentAnim,
        });
    }

    
    // method to send player name to Colyseus server
    updatePlayerName(message) {
        const {currentName, userId} = message;
        console.log("updatePlayerName", message);
        
        console.log(userId);
        this.room?.send(Message.UPDATE_PLAYER_NAME, { name: currentName , userId: userId});
    }
    
    // method to send ready-to-connect signal to Colyseus server
    readyToConnect() {
        this.room?.send(Message.READY_TO_CONNECT);
        phaserEvents.emit(Event.MY_PLAYER_READY);
    }
    
    // method to send ready-to-connect signal to Colyseus server
    videoConnected() {
        this.room?.send(Message.VIDEO_CONNECTED);
        phaserEvents.emit(Event.MY_PLAYER_VIDEO_CONNECTED);
    }
    
    // method to send stream-disconnection signal to Colyseus server
    playerStreamDisconnect(id: string) {
        this.room?.send(Message.DISCONNECT_STREAM, { clientId: id });
        this.webRTC?.deleteVideoStream(id);
    }

    connectToTable(id: string) {
        this.room?.send(Message.CONNECT_TO_TABLE, { tableId: id });
    }
    
    updateChairStatus(tableId?: string, chairId?: string , status?: boolean) {
        this.room?.send(Message.UPDATE_CHAIR_STATUS, {
            tableId: tableId,
            chairId: chairId,
            status: status,
        });
    }

    disconnectFromTable(id: string) {
        this.room?.send(Message.DISCONNECT_FROM_TABLE, { tableId: id });
    }
    onStopTableTalk(id: string) {
        this.room?.send(Message.STOP_TABLE_TALK, { tableId: id });
    }
    
    addChatMessage(content: string) {
        this.room?.send(Message.ADD_CHAT_MESSAGE, { content: content });
    }

    sendPrivateMessage(sender: string, receiver: string, content: string ) {
        this.room?.send(Message.SEND_DM, {  sender: sender, receiver: receiver, content: content  });
        this.checkPrivateMessage(receiver);
    }
    checkPrivateMessage(sender: string) {
        this.room?.send(Message.RECEIVE_DM, {  sender: sender });
    }
}
