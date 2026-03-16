import { BadRequestException, ConflictException } from '@nestjs/common'
import { WorkspaceService } from './workspace.service'

function createPrismaMock() {
  return {
    workspace: {
      findUnique: jest.fn(),
    },
    workspaceFile: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  }
}

describe('WorkspaceService', () => {
  it('throws conflict when moving folder into descendant path', async () => {
    const prisma = createPrismaMock()
    prisma.workspaceFile.findFirst.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
      name: 'src',
      path: '/src',
      language: 'plaintext',
      content: '',
      kind: 'folder',
      order: 1,
    })

    const service = new WorkspaceService(prisma as never)

    await expect(
      service.moveWorkspaceFile('workspace-id', 'folder-id', {
        targetPath: '/src/child/src',
      }),
    ).rejects.toThrow(ConflictException)
  })

  it('rejects root path when creating workspace file', async () => {
    const prisma = createPrismaMock()
    prisma.workspace.findUnique.mockResolvedValue({
      id: 'workspace-id',
      title: 'Workspace',
    })

    const service = new WorkspaceService(prisma as never)

    await expect(
      service.createWorkspaceFile('workspace-id', {
        name: 'root',
        path: '/',
        language: 'plaintext',
        content: '',
        kind: 'file',
        order: 1,
      }),
    ).rejects.toThrow(BadRequestException)
  })

  it('moves file to a new path and target order', async () => {
    const prisma = createPrismaMock()

    prisma.workspaceFile.findFirst
      .mockResolvedValueOnce({
        id: 'file-id',
        workspaceId: 'workspace-id',
        name: 'a.ts',
        path: '/a.ts',
        language: 'typescript',
        content: '',
        kind: 'file',
        order: 1,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'file-id',
        workspaceId: 'workspace-id',
        name: 'a.ts',
        path: '/dst/a.ts',
        language: 'typescript',
        content: '',
        kind: 'file',
        order: 1,
      })

    prisma.workspaceFile.findMany.mockResolvedValue([])
    prisma.workspaceFile.update.mockResolvedValue({})

    const service = new WorkspaceService(prisma as never)

    const result = await service.moveWorkspaceFile('workspace-id', 'file-id', {
      targetPath: '/dst/a.ts',
      targetOrder: 1,
    })

    expect(result.path).toBe('/dst/a.ts')
    expect(prisma.workspaceFile.update).toHaveBeenCalledWith({
      where: { id: 'file-id' },
      data: {
        path: '/dst/a.ts',
        order: 1,
      },
    })
  })

  it('normalizes duplicate slashes when creating workspace file path', async () => {
    const prisma = createPrismaMock()

    prisma.workspace.findUnique.mockResolvedValue({
      id: 'workspace-id',
      title: 'Workspace',
    })

    prisma.workspaceFile.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'created-id',
        workspaceId: 'workspace-id',
        name: 'main.ts',
        path: '/src/main.ts',
        language: 'typescript',
        content: '',
        kind: 'file',
        order: 1,
      })

    prisma.workspaceFile.create.mockResolvedValue({ id: 'created-id' })
    prisma.workspaceFile.findMany.mockResolvedValue([])

    const service = new WorkspaceService(prisma as never)

    const result = await service.createWorkspaceFile('workspace-id', {
      name: 'main.ts',
      path: '///src//main.ts',
      language: 'typescript',
      content: '',
      kind: 'file',
      order: 3,
    })

    expect(result.path).toBe('/src/main.ts')
    expect(prisma.workspaceFile.create).toHaveBeenCalledWith({
      data: {
        workspaceId: 'workspace-id',
        name: 'main.ts',
        path: '/src/main.ts',
        language: 'typescript',
        content: '',
        tags: [],
        kind: 'file',
        order: 3,
      },
    })
  })

  it('reassigns sibling order to continuous sequence after move', async () => {
    const prisma = createPrismaMock()

    prisma.workspaceFile.findFirst
      .mockResolvedValueOnce({
        id: 'file-id',
        workspaceId: 'workspace-id',
        name: 'a.ts',
        path: '/a.ts',
        language: 'typescript',
        content: '',
        kind: 'file',
        order: 7,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'file-id',
        workspaceId: 'workspace-id',
        name: 'a.ts',
        path: '/dst/a.ts',
        language: 'typescript',
        content: '',
        kind: 'file',
        order: 2,
      })

    prisma.workspaceFile.findMany.mockResolvedValueOnce([
      {
        id: 'file-id',
        workspaceId: 'workspace-id',
        name: 'a.ts',
        path: '/dst/a.ts',
        language: 'typescript',
        content: '',
        kind: 'file',
        order: 7,
      },
      {
        id: 'file-b',
        workspaceId: 'workspace-id',
        name: 'b.ts',
        path: '/dst/b.ts',
        language: 'typescript',
        content: '',
        kind: 'file',
        order: 1,
      },
    ])

    prisma.workspaceFile.update.mockResolvedValue({})
    prisma.$transaction.mockResolvedValue([])

    const service = new WorkspaceService(prisma as never)

    await service.moveWorkspaceFile('workspace-id', 'file-id', {
      targetPath: '/dst/a.ts',
      targetOrder: 99,
    })

    expect(prisma.workspaceFile.update).toHaveBeenCalledWith({
      where: { id: 'file-id' },
      data: { order: 2 },
    })
  })
})
