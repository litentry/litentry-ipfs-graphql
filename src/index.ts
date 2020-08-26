import { GraphQLServer } from 'graphql-yoga'
const Keystore = require('orbit-db-keystore')
const Identities = require('orbit-db-identity-provider')
import {OrbitDB} from 'orbit-db'
const IPFS = require('ipfs')

const typeDefs = `
  type Query {
    hello(name: String): String
    registerIdentity(identityId: String): String
  }
`

const config = {
  ipfs: {
    preload: {
      enabled: false
    },
    config: {
      EXPERIMENTAL: {
        pubsub: true // required, enables pubsub
      },
      Addresses: {
        Swarm: ['/dns4/damp-lake-31712.herokuapp.com/tcp/443/wss/p2p-webrtc-star/']
      }
    }
  }
}


let ipfs

const resolvers = {
  Query: {
    hello: (_, { name }) => {
      const returnValue = `Hello ${name || 'World!'}`
      return returnValue
    },
    registerIdentity: async (_, {identityId}) => {
      const keystore = new Keystore(`./identities/${identityId}`)
      const identity = await Identities.createIdentity({ keystore: keystore, id: 'identityId' })
      const orbitdb = await OrbitDB.createInstance(ipfs, { identity: identity })
      const db = await orbitdb.eventlog('first-database-litentry')
      db.load();
      console.log(db.address.toString())
      const hash = await db.add({ name: 'test1' })

// should always return same identity if you use the same keystore and id
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
    // await server.start(() => console.log('Server is running on http://localhost:4000'))
  } catch (e) {
    console.log('init error is', e)
  }
}


start();
