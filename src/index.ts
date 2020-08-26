import { GraphQLServer } from 'graphql-yoga'
const Identities = require('orbit-db-identity-provider')
const OrbitDB = require('orbit-db')
const IPFS = require('ipfs')

const typeDefs = `
  type Query {
    registerIdentity(identityId: String): String
    determineAddress(identityId: String): String
  }
`

const config = {
  ipfs: {
    preload: {
      enabled: false
    },
    repo: './ipfs',
    EXPERIMENTAL: {
      pubsub: true // required, enables pubsub
    },
    config: {
      Addresses: {
        Swarm: [
          // '/dns4/damp-lake-31712.herokuapp.com/tcp/443/wss/p2p-webrtc-star/'
          '/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star'
        ]
      }
    }
  }
}

const accessController = {
  write: ['*']
};

let ipfs
let orbitDb;
let isLocked: boolean = false;

const resolvers = {
  Query: {
    registerIdentity: async (_, {identityId}) => {
      if(isLocked) {
        return 'please try again later, db in using'
      }
      try {
        isLocked = true;
        const options = {id: identityId};
        const identity = await Identities.createIdentity(options)
        orbitDb = await OrbitDB.createInstance(ipfs, {identity: identity})
        const db = await orbitDb.eventlog(identityId, {
          accessController
        })
        // db.events.on('peer.exchanged', async (peer, address, heads) => {
        //   console.log('data exchanged!');
        //   console.log('address', address, 'head', 'head')
        //   await db.close();
        //   await orbitDb.disconnect();
        //   isLocked = false
        // } );
        const address = db.address.toString()
        setTimeout(async ()=> {
            await db.close();
            await orbitDb.disconnect();
            isLocked = false
        }, 5000)
        await db.load();
        const hash = await db.add({name: 'identity Created'})
        console.log('hash is', hash);
        console.log(address)
        return address
      } catch (e) {
        console.log('error' + e);
        return 'please try again later, db in using'
      }
    },
    determineAddress : async(_, {identityId}) => {
      if(isLocked) {
        return 'please try again later, db in using'
      }
      isLocked = true;
      const options = {id: 'haha'};
      const identity = await Identities.createIdentity(options)
      orbitDb = await OrbitDB.createInstance(ipfs, {identity: identity})
      const dbAddress = await orbitDb.determineAddress(identityId, 'eventlog', {
        accessController
      })
      await orbitDb.disconnect();
      isLocked = false;
      return dbAddress.toString();
    }
  }
}

const server = new GraphQLServer({
  typeDefs,
  resolvers
})

async function start() {
  try {
    ipfs = await IPFS.create(config.ipfs);
    await server.start({
      port: 4000,
      endpoint: '/graphql',
      getEndpoint: true,
      playground: '/playground',
    }, () => console.log('Server is running on http://localhost:4000'))
  } catch (e) {
    console.log('init error is', e)
  }
}


start();
