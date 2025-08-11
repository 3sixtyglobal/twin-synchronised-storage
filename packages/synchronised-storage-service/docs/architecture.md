# Synchronised Storage Service Architecture

## Overview

The Synchronised Storage Service implements a distributed, eventually-consistent data replication system built on a decentralised architecture. The system provides conflict-free, cryptographically-verifiable synchronisation of entity storage mutations across a network of heterogeneous nodes through a combination of trusted node coordination and decentralised storage protocols.

## Core Architecture

### System Components

#### 1. Entity Storage Layer

- **Purpose**: Persistent data layer storing application entities
- **Interface**: CRUD operations with change event emission via event bus
- **Implementation**: Pluggable storage connectors (Memory, File System, Database)
- **Change Detection**: Mutation observers capture CREATE, UPDATE, DELETE operations
- **Event Emission**: Publishes change notifications to event bus for downstream processing

#### 2. Change Capture Subsystem

- **Event Bus Integration**: Subscribes to entity storage change events via decoupled event bus architecture
- **Change Sets**: Immutable collections of related entity mutations aggregated from event notifications
- **Serialisation**: Compressed binary format with cryptographic signatures
- **Metadata**: Timestamps, node identity, operation vectors
- **Batching**: Configurable aggregation windows for performance optimisation

#### 3. Cryptographic Verification Layer

- **Digital Signatures**: DID Proofs on change set payloads
- **Identity Management**: DID-based node authentication
- **Proof Chains**: Verifiable computation proofs for data integrity
- **Encryption**: RSA-2048 encryption for sensitive payload data with SPKI keys available to regular nodes, and PKCS and SPKI on the trusted nodes

#### 5. Event Bus Architecture

- **Decoupled Communication**: Asynchronous message passing between entity storage and change capture systems
- **Topic-Based Routing**: Structured message topics for different operation types (create, update, delete)
- **Pluggable Connectors**: Support for various event bus implementations (Local, Redis, AMQP, Kafka)
- **Message Serialisation**: JSON-based message payloads with type-safe schemas

#### 6. Network Topology

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Regular Node  │    │   Regular Node  │    │   Regular Node  │
│                 │    │                 │    │                 │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
   ┌──────────▼──────────┐              ┌────────▼────────────┐
   │   Trusted Node A    │              │   Trusted Node B    │
   │ • Change Validation │              │ • Change Validation │
   │ • Load Distribution │              │ • Load Distribution │
   │ • State Consensus   │◄────────────►│ • State Consensus   │
   └──────────┬──────────┘              └─────────┬───────────┘
              │                                   │
              └─────────────────┬─────────────────┘
                                │
                    ┌───────────▼────────────┐
                    │  Verifiable Storage    │
                    │   • On-chain Pointers  │
                    │   • State Root Hashes  │
                    │   • Access Control     │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │ Decentralised Storage  │
                    │   • IPFS/Content Hash  │
                    │   • Immutable Blobs    │
                    │   • Distributed Refs   │
                    └────────────────────────┘
```

## Node Types & Responsibilities

### Regular Nodes

- **Local Change Monitoring**: Capture entity storage mutations via event bus
- **Change Set Generation**: Aggregate mutations into signed, compressed payloads
- **Trusted Node Communication**: Submit change sets for global replication
- **Sync State Polling**: Periodically query verifiable storage for remote updates
- **Conflict Resolution**: Apply three-way merge algorithms for concurrent modifications
- **Resource Constraints**: Minimal storage and computational requirements

### Trusted Nodes

- **Multi-Node Architecture**: Multiple trusted nodes operate in parallel to distribute processing load and provide high availability
- **Change Validation**: Verify cryptographic signatures and node permissions across the cluster
- **Change Set Consolidation**: Periodic compaction of historical change logs distributed across trusted node instances
- **Decentralised Storage Interface**: Upload/download operations to IPFS-like systems with load balancing
- **Verifiable Storage Updates**: Atomic updates to on-chain state pointers with consensus agreement
- **Load Distribution**: Automatic distribution of regular node connections and change processing across available trusted nodes

## Data Flow Architecture

### 1. Local Change Detection

```typescript
EntityStorage → ChangeCapture → LocalSnapshot → EventBus
```

### 2. Change Set Propagation

```typescript
LocalNode → [Sign] → ChangeSet → TrustedNode → [Validation] → GlobalState
```

### 3. Global State Persistence

```typescript
TrustedNode → [Sign & Compression] → DecentralisedStorage → [StateRoot] → VerifiableStorage
```

### 4. Remote Synchronisation

```typescript
AnyNode → [Poll] → VerifiableStorage → [Fetch] → DecentralisedStorage → [Merge] → LocalState
```

## Data Structures

- Sync Pointer Store - stored in verifiable storage, for each storage type contains a storage id of the location for sync states
- Sync State - stored in decentralised storage, contains all of the snapshots for a specific storage key
- Sync Snapshot - contains a list of all the decentralised storage ids for the change sets which make up the snapshot
- Change Set - contains a set of changes to be made to the entity storage
