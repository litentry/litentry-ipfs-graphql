# Litentry Graphql Caching Server

## Getting started

```
yarn start
```

![](https://imgur.com/hElq68i.png)


For Javascript applications, please use [Litentry SDK](https://github.com/litentry/litentry-sdk) to interact with Server! we have already wrapped the function there

## Documentation

Query types

```typescript
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
```

Example for query `playgroundRecord` data of certain identity  

```
https://graphql.litentry.com:4000/graphql?query={getData(identityId:"0x992c710c7fba11ccd22a2fbfec1af6ea85d488807e63e10cbbd16256fcf95752"){playgroundRecord}}
```

query IPFS address of certain identity
```
https://graphql.litentry.com:4000/graphql?query={determineAddress(identityId:"0x992c710c7fba11ccd22a2fbfec1af6ea85d488807e63e10cbbd16256fcf95752")}
``

