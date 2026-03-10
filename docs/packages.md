# Synchronised Storage Packages

## synchronised-storage-models

This package defines the shared models, constants, and schema structures used by synchronised storage messages. It gives service and client components a consistent contract for change sets, event topics, and payload formats so interoperability remains predictable across the repository.

- [README](../packages/synchronised-storage-models/README.md)
- [Examples](../packages/synchronised-storage-models/docs/examples.md)
- [Changelog](../packages/synchronised-storage-models/docs/changelog.md)

## synchronised-storage-service

This package implements the service layer that coordinates local and remote synchronisation state. It handles key synchronisation workflows, tracks snapshots and changesets, and exposes REST entry points so trusted and untrusted nodes can participate in a reliable sync process.

- [README](../packages/synchronised-storage-service/README.md)
- [Examples](../packages/synchronised-storage-service/docs/examples.md)
- [Changelog](../packages/synchronised-storage-service/docs/changelog.md)

## synchronised-storage-rest-client

This package provides a focused REST client for synchronised storage endpoints. It is used to request decryption keys from trusted nodes and submit change sets, making it easier to integrate remote synchronisation calls into other services.

- [README](../packages/synchronised-storage-rest-client/README.md)
- [Examples](../packages/synchronised-storage-rest-client/docs/examples.md)
- [Changelog](../packages/synchronised-storage-rest-client/docs/changelog.md)

## entity-storage-connector-synchronised

This package connects entity storage operations with synchronisation topics so local changes can be published and remote updates can be applied. It helps keep persisted entities aligned between nodes while preserving an entity storage connector interface.

- [README](../packages/entity-storage-connector-synchronised/README.md)
- [Examples](../packages/entity-storage-connector-synchronised/docs/examples.md)
- [Changelog](../packages/entity-storage-connector-synchronised/docs/changelog.md)
