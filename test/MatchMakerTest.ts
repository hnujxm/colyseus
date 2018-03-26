(<any>process.env).COLYSEUS_PRESENCE_TIMEOUT = 50;

import * as assert from 'assert';
import * as sinon from 'sinon';

import { MatchMaker } from "../src/MatchMaker";
import { RegisteredHandler } from './../src/matchmaker/RegisteredHandler';
import { Room } from "../src/Room";

import { generateId, Protocol, isValidId } from "../src";
import { createDummyClient, DummyRoom, RoomVerifyClient, Client, RoomVerifyClientWithLock } from "./utils/mock";

process.on('unhandledRejection', (reason, promise) => {
  console.log(reason, promise);
});

describe('MatchMaker', function() {
  let matchMaker;
  let roomRegisteredHandler: RegisteredHandler;

  beforeEach(() => {
    matchMaker = new MatchMaker();

    roomRegisteredHandler = matchMaker.registerHandler('room', DummyRoom);
    matchMaker.registerHandler('dummy_room', DummyRoom);
    matchMaker.registerHandler('room_with_default_options', DummyRoom, { level: 1 });
    matchMaker.registerHandler('room_verify_client', RoomVerifyClient);
    matchMaker.registerHandler('room_verify_client_with_lock', RoomVerifyClientWithLock);
  });

  describe('room handlers', function() {
    it('should add handler with name', function() {
      assert.ok(matchMaker.hasHandler('room'));
    });

    it('should create a new room ', async () => {
      let roomId = await matchMaker.onJoinRoomRequest(createDummyClient(), 'room', {}, true);
      let room = matchMaker.getRoomById(roomId)
      assert.ok(typeof (room.roomId) === "string");
      assert.ok(room instanceof Room);
    });

    it('onInit should receive client options as second argument when creating room', function() {
      const onInitStub = sinon.stub(DummyRoom.prototype, 'onInit').returns(true);
      matchMaker.create('room_with_default_options', { map: "forest" });
      assert.deepEqual(onInitStub.getCall(0).args, [{ level: 1, map: "forest" }]);

      matchMaker.create('room_with_default_options', { level: 2 });
      assert.deepEqual(onInitStub.getCall(1).args, [{ level: 1 }], "shouldn't be possible to overwrite arguments");

      onInitStub.restore();
    });

    it('shouldn\'t return when trying to join with invalid room id', async () => {
      let roomId = await matchMaker.joinById('invalid_id', {});
      assert.equal(roomId, undefined);
    });

    it('shouldn\'t create room when requesting to join room with invalid params', async () => {
      try {
        await matchMaker.onJoinRoomRequest(createDummyClient(), 'dummy_room', { invalid_param: 10 });
      } catch (e) {
        assert.equal(e.message, "join_request_fail");
      }
    });

    it('shouldn\t return room instance when trying to join existing room by id with invalid params', async () => {
      let roomId = await matchMaker.onJoinRoomRequest(createDummyClient(), 'room', {});
      assert.ok(isValidId(roomId));

      let joinByRoomId = await matchMaker.joinById(roomId, { invalid_param: 1 });
      assert.equal(joinByRoomId, undefined);
    });

    it('should join existing room using "joinById"', async () => {
      let roomId = await matchMaker.onJoinRoomRequest(createDummyClient(), 'room', {});
      assert.ok(isValidId(roomId));

      let joinByRoomId = await matchMaker.joinById(roomId, {});
      assert.ok(isValidId(joinByRoomId));
    });

    it('should call "onDispose" when room is not created', function(done) {
      const stub = sinon.stub(DummyRoom.prototype, 'requestJoin').returns(false);
      const spy = sinon.spy(DummyRoom.prototype, 'onDispose');
      const room = matchMaker.create('dummy_room', {});
      assert.ok(spy.calledOnce);
      assert.equal(null, room);
      stub.restore();
      spy.restore();
      done();
    });

    it('should emit error if room name is not a valid id', async () => {
      const invalidRoomName = 'fjf10jf10jf0jf0fj';
      try {
        await matchMaker.onJoinRoomRequest(createDummyClient(), invalidRoomName, {});

      } catch (e) {
        assert.equal(e.message, "join_request_fail");
      }
    });

  });

  describe('onJoin', () => {
    it('should send error message to client when joining invalid room', async () => {
      let client = createDummyClient({});

      try {
        await matchMaker.connectToRoom(client, generateId());
        assert.fail("an error should be thrown here.");

      } catch (e) {
        assert.equal(e.message, "remote room timed out");
      }
    });
  });

  // describe('verifyClient', () => {
  //   it('should\'t allow to connect when verifyClient returns false', (done) => {
  //     let client = createDummyClient();

  //     RoomVerifyClient.prototype.verifyClient = () => false;

  //     matchMaker.onJoinRoomRequest('room_verify_client', { clientId: client.id }, true, (err, room) => {
  //       matchMaker.bindClient(client, room.roomId).then((room) => {
  //         throw new Error("this promise shouldn't succeed");

  //       }).catch(err => {
  //         assert.ok(typeof (err) === "string");
  //         assert.equal(client.lastMessage[0], Protocol.JOIN_ERROR);
  //         done();
  //       });
  //     });
  //   });

  //   it('should\'t allow to connect when verifyClient returns a failed promise', (done) => {
  //     let client = createDummyClient();

  //     RoomVerifyClient.prototype.verifyClient = () => new Promise((resolve, reject) => {
  //       setTimeout(() => reject("forbidden"), 50);
  //     });

  //     matchMaker.onJoinRoomRequest('room_verify_client', { clientId: client.id }, true, (err, room) => {
  //       matchMaker.bindClient(client, room.roomId).then((room) => {
  //         throw new Error("this promise shouldn't succeed");

  //       }).catch(err => {
  //         assert.equal(err, "forbidden");
  //         assert.equal(client.lastMessage[0], Protocol.JOIN_ERROR);
  //         done();
  //       });
  //     });
  //   });

  //   it('should allow to connect when verifyClient returns true', (done) => {
  //     let client = createDummyClient();

  //     RoomVerifyClient.prototype.verifyClient = () => true;

  //     matchMaker.onJoinRoomRequest('room_verify_client', { clientId: client.id }, true, (err, room) => {
  //       matchMaker.bindClient(client, room.roomId).then((room) => {
  //         assert.ok(room instanceof Room);
  //         done();

  //       }).catch(err => {
  //         throw new Error(err);
  //       });
  //     });
  //   });

  //   it('should allow to connect when verifyClient returns fulfiled promise', (done) => {
  //     let client = createDummyClient();

  //     RoomVerifyClient.prototype.verifyClient = () => new Promise((resolve, reject) => {
  //       setTimeout(() => resolve(), 50);
  //     });

  //     matchMaker.onJoinRoomRequest('room_verify_client', { clientId: client.id }, true, (err, room) => {
  //       matchMaker.bindClient(client, room.roomId).then((room) => {
  //         assert.equal(1, room.clients.length);
  //         assert.ok(room instanceof Room);
  //         done();

  //       }).catch(err => {
  //         throw new Error(err);
  //       });
  //     });
  //   });

  //   it('should handle leaving room before onJoin is fulfiled.', (done) => {
  //     const onDisposeSpy = sinon.spy(RoomVerifyClient.prototype, 'onDispose');

  //     RoomVerifyClient.prototype.verifyClient = () => new Promise((resolve, reject) => {
  //       setTimeout(() => resolve(), 100);
  //     });

  //     let client = createDummyClient();

  //     matchMaker.onJoinRoomRequest('room_verify_client', { clientId: client.id }, true, (err, room) => {
  //       matchMaker.bindClient(client, room.roomId).then((room) => {
  //         throw new Error("this promise shouldn't succeed");

  //       }).catch(err => {
  //         assert.equal(0, room.clients.length);
  //         assert.deepEqual({}, matchMaker.sessions);
  //         assert.ok(onDisposeSpy.calledOnce);
  //         onDisposeSpy.restore();

  //         done();
  //       });

  //       client.emit('close');
  //     });
  //   });

  //   xit('shouldn\'t accept second client when room is locked after first one', (done) => {
  //     let client = createDummyClient();

  //     matchMaker.onJoinRoomRequest('room_verify_client_with_lock', { clientId: client.id }, true, (err, room) => {
  //       matchMaker.bindClient(client, room.roomId).then((room) => {
  //         assert.equal(1, room.clients.length);
  //         assert.ok(room instanceof Room);

  //       }).catch(err => {
  //         throw new Error("this promise shouldn't fail");
  //       });
  //     });

  //     // try to join with a second client when the room will be locked
  //     setTimeout(() => {
  //       let client = createDummyClient();
  //       matchMaker.onJoinRoomRequest('room_verify_client_with_lock', { clientId: client.id }, true, (err, room) => {
  //         matchMaker.bindClient(client, room.roomId).then((room) => {
  //           assert.equal(1, room.clients.length);
  //           assert.ok(room instanceof Room);
  //           done();

  //         }).catch(err => {
  //           throw new Error("this promise shouldn't fail");
  //         });
  //       });
  //     }, 10);

  //   });
  // });

  describe('registered handler events', () => {
    it('should trigger "create" event', (done) => {
      matchMaker.handlers["room"].on("create", (room) => {
        assert.ok(room instanceof Room);
        done();
      });

      matchMaker.create('room', {});
    });

    it('should trigger "dispose" event', (done) => {
      let dummyRoom = matchMaker.getRoomById(matchMaker.create('room', {}));

      matchMaker.handlers["room"].on("dispose", (room) => {
        assert.ok(room instanceof Room);
        done();
      });

      dummyRoom.emit("dispose");
    });

    it('should trigger "join" event', async (done) => {
      let dummyRoom = matchMaker.getRoomById(matchMaker.create('room', {}));

      matchMaker.handlers["room"].on("join", (room, client) => {
        assert.ok(room instanceof Room);
        assert.ok(client instanceof Client);
        done();
      });

      let client = createDummyClient();
      let room = matchMaker.getRoomById(await matchMaker.onJoinRoomRequest(client, 'room', {}));
      (room as any)._onJoin(client, {});
    });

    it('should trigger "lock" event', (done) => {
      matchMaker.handlers["room"].on("lock", (room) => done());
      matchMaker.handlers["room"].on("create", (room) => room.lock());
      matchMaker.create('room', {});
    });

    it('should trigger "unlock" event', (done) => {
      matchMaker.handlers["room"].on("unlock", (room) => done());
      matchMaker.handlers["room"].on("create", (room) => {
        room.lock();
        room.unlock();
      });
      matchMaker.create('room', {});
    });

    it('should\'nt trigger "unlock" if room hasn\'t been locked before', (done) => {
      matchMaker.handlers["room"].on("unlock", (room) => {
        throw new Error("shouldn't trigger 'unlock' event here");
      });
      matchMaker.handlers["room"].on("create", (room) => room.unlock());
      setTimeout(() => done(), 100);
      matchMaker.create('room', {});
    });

    it('should trigger "leave" event', async (done) => {
      let dummyRoom = matchMaker.getRoomById(matchMaker.create('room', {}));

      matchMaker.handlers["room"].on("leave", (room, client) => {
        assert.ok(room instanceof Room);
        assert.ok(client instanceof Client);
        done();
      });

      let client = createDummyClient();
      let room = matchMaker.getRoomById(await matchMaker.onJoinRoomRequest(client, 'room', { clientId: client.id }));
      room._onJoin(client);
      room._onLeave(client);
    });
  });

  describe('onJoinRoomRequest', () => {
    it('should remove reserved seat after joining the room', (done) => {
      let client = createDummyClient();

      matchMaker.onJoinRoomRequest('room', { clientId: client.id }, true, (err, room) => {
        matchMaker.bindClient(client, room.roomId).then((room) => {
          setTimeout(() => {
            assert.deepEqual({}, room.connectingClients);
            done();
          }, 5);
        });
      });
    });
  });

});