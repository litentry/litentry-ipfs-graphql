import { GraphQLServer } from 'graphql-yoga'
const Identities = require('orbit-db-identity-provider')
const OrbitDB = require('orbit-db')
const IPFS = require('ipfs')

const typeDefs = `
  type Query {
    registerIdentity(identityId: String): String
    determineAddress(identityId: String): String
    addData(identityId: String, data: String): String
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

const createOrbitInstance = async (identityId: string) => {
  const options = {id: identityId};
  const identity = await Identities.createIdentity(options)
  orbitDb = await OrbitDB.createInstance(ipfs, {identity: identity})
  return orbitDb;
}

const accessDb = async (identityId: string) => {
  const db = await orbitDb.eventlog(identityId, {
    accessController
  })
  return db;
};

const resolvers = {
  Query: {
    registerIdentity: async (_, {identityId}) => {
      if(isLocked) {
        return 'please try again later, db in using'
      }
      try {
        isLocked = true;
        orbitDb = await createOrbitInstance(identityId);
        const db = await accessDb(identityId);
        // db.events.on('peer.exchanged', async (peer, address, heads) => {
        //   console.log('data exchanged!');
        //   console.log('address', address, 'head', 'head')
        //   await db.close();
        //   await orbitDb.disconnect();
        //   isLocked = false
        // } );
        const address = db.address.toString()
        await db.load();
        const hash = await db.add({name: 'identity Created'})
        setTimeout(async ()=> {
          await db.close();
          await orbitDb.disconnect();
          isLocked = false
        }, 5000)
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
      orbitDb = await createOrbitInstance(identityId);
      const dbAddress = await orbitDb.determineAddress(identityId, 'eventlog', {
        accessController
      })
      await orbitDb.disconnect();
      isLocked = false;
      return dbAddress.toString();
    },
    addData: async(_, {identityId, data}) => {
      try {
        if (isLocked) {
          return 'please try again later, db in using'
        }
        orbitDb = await createOrbitInstance(identityId);
        const db = await accessDb(identityId);
        setTimeout(async () => {
          await db.close();
          await orbitDb.disconnect();
          isLocked = false
        }, 5000)
        await db.load();
        const hash = await db.add({data})
        return data;
      } catch(e) {
        console.log('error' + e);
        return 'please try again later, db in using'
      }
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
