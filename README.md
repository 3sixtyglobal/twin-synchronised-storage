# TWIN Synchronised Storage

This repository provides the building blocks needed to replicate entity changes safely across connected nodes. It brings together shared message models, a service that manages synchronisation state, a REST client for trusted node communication, and an entity storage connector that integrates synchronisation into application persistence flows.

Taken together, these packages help teams establish consistent synchronisation behaviour across local and remote environments, while keeping contracts, change tracking, and transport concerns in clearly separated components.

## Packages

- [synchronised-storage-models](packages/synchronised-storage-models/README.md) - Shared models, constants, and schemas for synchronised storage messages and contracts.
- [synchronised-storage-service](packages/synchronised-storage-service/README.md) - Service implementation that coordinates synchronisation state and exposes REST entry points.
- [synchronised-storage-rest-client](packages/synchronised-storage-rest-client/README.md) - REST client for trusted decryption key retrieval and change set synchronisation.
- [entity-storage-connector-synchronised](packages/entity-storage-connector-synchronised/README.md) - Entity storage connector that publishes local changes and applies remote updates.

## Contributing

To contribute to this package see the guidelines for building and publishing in [CONTRIBUTING](./CONTRIBUTING.md)
