import {GraphQLServer} from 'graphql-yoga'
import EventStore from 'orbit-db-eventstore';

const Identities = require('orbit-db-identity-provider')
const OrbitDB = require('orbit-db')
const IPFS = require('ipfs')
const level = require('level')
const fs = require('fs')

const recordKey = 'playgroundRecord';
const dbName = 'playGroundData'
const cache = level(dbName, {
  location:'./playGroundData'
}, function (err, cacheDb) {
  if (err)
    console.log('cache db load error:'+ err);
  console.log('cache db started');
})

const typeDefs = `
  type Record {
    ${recordKey}: String
  }
  type Query {
    registerIdentity(identityId: String): String
    determineAddress(identityId: String): String
    addData(identityId: String, data: String): String
    addDataAddress(address: String, data: String): String
    getData(identityId: String): [Record]
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

type Record = {[recordKey]: string}
const fetchListDataAndCache = async (identityId: string, db: EventStore<Record>, newData?: Record) => {
  try {
    const all = db.iterator({limit: -1})
      .collect()
      .map((e) => e.payload.value)
    all.push(newData);
    await cache.put(identityId, JSON.stringify(all));
  } catch(e){
    console.log('local cache error', e.toString());
  }
}

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
        const newData = {[recordKey]: 'identity Created'};
        const hash = await db.add(newData)
        fetchListDataAndCache(identityId, db, newData)
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
        const newData = {[recordKey]: data};
        await fetchListDataAndCache(identityId, db, newData)
        const hash = await db.add(newData)
        return data;
      } catch(e) {
        console.log('error' + e);
        return 'please try again later, db in using'
      }
    },
    getData: async(_, {identityId}) => {
      try {
        const data = await cache.get(identityId);
        console.log('data is', JSON.parse(data));
        return JSON.parse(data);
      } catch (e){
        console.log('get request error:', e.toString());
        return [];
      }
    }
  }
}

const server = new GraphQLServer({
  typeDefs,
  resolvers
})

async function start() {
  const environment = process.env.NODE_ENV
  const isProduction = environment === 'production';
  try {
    ipfs = await IPFS.create(config.ipfs);
    if(isProduction) {
      await server.start({
        port: 4000,
        endpoint: '/graphql',
        https: {
          cert: fs.readFileSync('/etc/letsencrypt/archive/graphql.litentry.com/cert1.pem', 'utf8'),
          key: fs.readFileSync('/etc/letsencrypt/archive/graphql.litentry.com/privkey1.pem', 'utf8')
        },
        getEndpoint: true,
        playground: '/playground',
      }, () => console.log('Production Server is running on http://localhost:4000'))
    } else {
      if(isProduction) {
        await server.start({
          port: 4000,
          endpoint: '/graphql',
          getEndpoint: true,
          playground: '/playground',
        }, () => console.log('Server is running on http://localhost:4000'))
      }
    }
  } catch (e) {
    console.log('init error is', e)
  }
}


start();
