"use client"

import { useWallet } from "@solana/wallet-adapter-react"
import { useCarbonProgram } from "./carbon-data-access"
import { useState } from "react"
import { PublicKey } from "@solana/web3.js"
import BN from "bn.js"
import { WalletButton } from "../solana/solana-provider"

export const ADMIN_PK = new PublicKey("GToMxgF4JcNn8dmNiHt2JrrvLaW6S1zSPoL2W8K2Wkmi");

export default function CarbonCredit() {
    const { publicKey, connected } = useWallet()
    const { 
        initializeProgramHandler, 
        issueCreditsHandler, 
        verifyProjectHandler, 
        createProjectHandler, 
        creditBatchAccounts, 
        programStateAccounts, 
        projectAccounts, 
        retireCreditsHandler, 
        retirementAccounts, 
        transferCreditsHandler 
    } = useCarbonProgram()

    // Form states
    const [createProjectForm, setCreateProjectForm] = useState({
        projectId: "",
        name: "",
        description: "",
        location: "",
        projectType: "reforestation",
        verificationStandard: "",
        estimatedCredits: ""
    })

    const [issueCreditsForm, setIssueCreditsForm] = useState({
        projectId: "",
        amount: "",
        vintageYear: new Date().getFullYear().toString(),
        metadataUri: "",
        recipientAddress: "",
        mintAddress: "",
        mintAuthority: ""
    })

    const [retireCreditsForm, setRetireCreditsForm] = useState({
        batchId: "",
        amount: "",
        reason: "",
        mintAddress: ""
    })

    const [transferCreditsForm, setTransferCreditsForm] = useState({
        toAddress: "",
        amount: "",
        mintAddress: ""
    })

    const [verifyProjectId, setVerifyProjectId] = useState("")

    const projectTypeOptions = [
        { value: "reforestation", label: "Reforestation" },
        { value: "renewableEnergy", label: "Renewable Energy" },
        { value: "energyEfficiency", label: "Energy Efficiency" },
        { value: "wasteManagement", label: "Waste Management" },
        { value: "carbonCapture", label: "Carbon Capture" },
        { value: "other", label: "Other" }
    ]

    const getProjectTypeObject = (type: string) => {
        const typeMap: Record<string, any> = {
            reforestation: { reforestation: {} },
            renewableEnergy: { renewableEnergy: {} },
            energyEfficiency: { energyEfficiency: {} },
            wasteManagement: { wasteManagement: {} },
            carbonCapture: { carbonCapture: {} },
            other: { other: {} }
        }
        return typeMap[type] || { other: {} }
    }

    const handleInitializeProgram = async () => {
        if (!publicKey) return
        await initializeProgramHandler.mutateAsync({
            authorityPubkey: publicKey
        })
    }

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!publicKey || !createProjectForm.projectId || !createProjectForm.name) return

        await createProjectHandler.mutateAsync({
            projectOwnerPubkey: publicKey,
            projectId: new BN(createProjectForm.projectId),
            projectName: createProjectForm.name,
            projectDescription: createProjectForm.description,
            projectLocation: createProjectForm.location,
            projectType: getProjectTypeObject(createProjectForm.projectType),
            verificationStandard: createProjectForm.verificationStandard,
            estimatedCredits: new BN(createProjectForm.estimatedCredits || "0")
        })

        // Reset form
        setCreateProjectForm({
            projectId: "",
            name: "",
            description: "",
            location: "",
            projectType: "reforestation",
            verificationStandard: "",
            estimatedCredits: ""
        })
    }

    const handleVerifyProject = async () => {
        if (!publicKey || !verifyProjectId) return

        await verifyProjectHandler.mutateAsync({
            authorityPubkey: publicKey,
            projectId: new BN(verifyProjectId)
        })
        setVerifyProjectId("")
    }

    const handleIssueCredits = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!publicKey || !issueCreditsForm.projectId || !issueCreditsForm.amount) return

        try {
            await issueCreditsHandler.mutateAsync({
                authorityPubkey: publicKey,
                projectId: new BN(issueCreditsForm.projectId),
                amount: new BN(issueCreditsForm.amount),
                vintageYear: parseInt(issueCreditsForm.vintageYear),
                metadataUri: issueCreditsForm.metadataUri,
                recipientPubkey: new PublicKey(issueCreditsForm.recipientAddress),
                mint: new PublicKey(issueCreditsForm.mintAddress),
                mintAuthorityPubkey: new PublicKey(issueCreditsForm.mintAuthority)
            })

            // Reset form
            setIssueCreditsForm({
                projectId: "",
                amount: "",
                vintageYear: new Date().getFullYear().toString(),
                metadataUri: "",
                recipientAddress: "",
                mintAddress: "",
                mintAuthority: ""
            })
        } catch (error) {
            console.error("Error issuing credits:", error)
        }
    }

    const handleRetireCredits = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!publicKey || !retireCreditsForm.batchId || !retireCreditsForm.amount) return

        try {
            await retireCreditsHandler.mutateAsync({
                userPubkey: publicKey,
                batchId: new BN(retireCreditsForm.batchId),
                amount: new BN(retireCreditsForm.amount),
                reason: retireCreditsForm.reason,
                mint: new PublicKey(retireCreditsForm.mintAddress)
            })

            // Reset form
            setRetireCreditsForm({
                batchId: "",
                amount: "",
                reason: "",
                mintAddress: ""
            })
        } catch (error) {
            console.error("Error retiring credits:", error)
        }
    }

    const handleTransferCredits = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!publicKey || !transferCreditsForm.toAddress || !transferCreditsForm.amount) return

        try {
            await transferCreditsHandler.mutateAsync({
                fromAuthorityPubkey: publicKey,
                toPubkey: new PublicKey(transferCreditsForm.toAddress),
                amount: new BN(transferCreditsForm.amount),
                mint: new PublicKey(transferCreditsForm.mintAddress)
            })

            // Reset form
            setTransferCreditsForm({
                toAddress: "",
                amount: "",
                mintAddress: ""
            })
        } catch (error) {
            console.error("Error transferring credits:", error)
        }
    }

    if (!connected) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center py-20">
                        <h1 className="text-4xl font-bold text-gray-800 mb-4">Carbon Credit DeFi Platform</h1>
                        <p className="text-xl text-gray-600 mb-8">Please connect your wallet to continue</p>
                        <div className="flex justify-center">
                            <WalletButton />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">Carbon Credit DeFi Platform</h1>
                    <p className="text-lg text-gray-600">Tokenize, trade, and retire carbon credits on Solana</p>
                    <div className="flex justify-center">
                        <WalletButton className="bg-black" />
                    </div>
                </div>

                {/* Program Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Total Projects</h3>
                        <p className="text-3xl font-bold text-green-600">
                            {programStateAccounts.data?.[0]?.account?.projectCount?.toString() || "0"}
                        </p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Credits Issued</h3>
                        <p className="text-3xl font-bold text-blue-600">
                            {programStateAccounts.data?.[0]?.account?.totalCreditsIssued?.toString() || "0"}
                        </p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Credits Retired</h3>
                        <p className="text-3xl font-bold text-red-600">
                            {programStateAccounts.data?.[0]?.account?.totalCreditsRetired?.toString() || "0"}
                        </p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Active Batches</h3>
                        <p className="text-3xl font-bold text-purple-600">
                            {creditBatchAccounts.data?.length || 0}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Initialize Program */}
                    {publicKey && publicKey.equals(ADMIN_PK) && (
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h2 className="text-2xl font-bold text-gray-800 mb-4">Initialize Program</h2>
                            <p className="text-gray-600 mb-4">Initialize the carbon credit program (Authority only)</p>
                            <button
                                onClick={handleInitializeProgram}
                                disabled={initializeProgramHandler.isPending}
                                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                {initializeProgramHandler.isPending ? "Initializing..." : "Initialize Program"}
                            </button>
                        </div>
                    )}

                    {/* Create Project */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Create Project</h2>
                        <form onSubmit={handleCreateProject} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
                                <input
                                    type="number"
                                    value={createProjectForm.projectId}
                                    onChange={(e) => setCreateProjectForm({...createProjectForm, projectId: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                                <input
                                    type="text"
                                    value={createProjectForm.name}
                                    onChange={(e) => setCreateProjectForm({...createProjectForm, name: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    maxLength={50}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={createProjectForm.description}
                                    onChange={(e) => setCreateProjectForm({...createProjectForm, description: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    maxLength={200}
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                <input
                                    type="text"
                                    value={createProjectForm.location}
                                    onChange={(e) => setCreateProjectForm({...createProjectForm, location: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    maxLength={100}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
                                <select
                                    value={createProjectForm.projectType}
                                    onChange={(e) => setCreateProjectForm({...createProjectForm, projectType: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                    {projectTypeOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Verification Standard</label>
                                <input
                                    type="text"
                                    value={createProjectForm.verificationStandard}
                                    onChange={(e) => setCreateProjectForm({...createProjectForm, verificationStandard: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="e.g., VCS, Gold Standard"
                                    maxLength={50}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Credits</label>
                                <input
                                    type="number"
                                    value={createProjectForm.estimatedCredits}
                                    onChange={(e) => setCreateProjectForm({...createProjectForm, estimatedCredits: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={createProjectHandler.isPending}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                {createProjectHandler.isPending ? "Creating..." : "Create Project"}
                            </button>
                        </form>
                    </div>

                    {/* Verify Project */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Verify Project</h2>
                        <p className="text-gray-600 mb-4">Verify a project (Authority only)</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
                                <input
                                    type="number"
                                    value={verifyProjectId}
                                    onChange={(e) => setVerifyProjectId(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                            </div>
                            <button
                                onClick={handleVerifyProject}
                                disabled={verifyProjectHandler.isPending || !verifyProjectId}
                                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                {verifyProjectHandler.isPending ? "Verifying..." : "Verify Project"}
                            </button>
                        </div>
                    </div>

                    {/* Issue Credits */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Issue Credits</h2>
                        <form onSubmit={handleIssueCredits} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
                                <input
                                    type="number"
                                    value={issueCreditsForm.projectId}
                                    onChange={(e) => setIssueCreditsForm({...issueCreditsForm, projectId: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                                <input
                                    type="number"
                                    value={issueCreditsForm.amount}
                                    onChange={(e) => setIssueCreditsForm({...issueCreditsForm, amount: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Vintage Year</label>
                                <input
                                    type="number"
                                    value={issueCreditsForm.vintageYear}
                                    onChange={(e) => setIssueCreditsForm({...issueCreditsForm, vintageYear: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Metadata URI</label>
                                <input
                                    type="url"
                                    value={issueCreditsForm.metadataUri}
                                    onChange={(e) => setIssueCreditsForm({...issueCreditsForm, metadataUri: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="https://example.com/metadata.json"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Address</label>
                                <input
                                    type="text"
                                    value={issueCreditsForm.recipientAddress}
                                    onChange={(e) => setIssueCreditsForm({...issueCreditsForm, recipientAddress: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="Recipient wallet address"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mint Address</label>
                                <input
                                    type="text"
                                    value={issueCreditsForm.mintAddress}
                                    onChange={(e) => setIssueCreditsForm({...issueCreditsForm, mintAddress: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="Token mint address"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mint Authority</label>
                                <input
                                    type="text"
                                    value={issueCreditsForm.mintAuthority}
                                    onChange={(e) => setIssueCreditsForm({...issueCreditsForm, mintAuthority: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="Mint authority address"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={issueCreditsHandler.isPending}
                                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                {issueCreditsHandler.isPending ? "Issuing..." : "Issue Credits"}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Retire Credits */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Retire Credits</h2>
                        <form onSubmit={handleRetireCredits} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Batch ID</label>
                                <input
                                    type="number"
                                    value={retireCreditsForm.batchId}
                                    onChange={(e) => setRetireCreditsForm({...retireCreditsForm, batchId: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Retire</label>
                                <input
                                    type="number"
                                    value={retireCreditsForm.amount}
                                    onChange={(e) => setRetireCreditsForm({...retireCreditsForm, amount: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Retirement Reason</label>
                                <textarea
                                    value={retireCreditsForm.reason}
                                    onChange={(e) => setRetireCreditsForm({...retireCreditsForm, reason: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="e.g., Flight emissions offset"
                                    maxLength={200}
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mint Address</label>
                                <input
                                    type="text"
                                    value={retireCreditsForm.mintAddress}
                                    onChange={(e) => setRetireCreditsForm({...retireCreditsForm, mintAddress: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="Token mint address"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={retireCreditsHandler.isPending}
                                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                {retireCreditsHandler.isPending ? "Retiring..." : "Retire Credits"}
                            </button>
                        </form>
                    </div>

                    {/* Transfer Credits */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Transfer Credits</h2>
                        <form onSubmit={handleTransferCredits} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">To Address</label>
                                <input
                                    type="text"
                                    value={transferCreditsForm.toAddress}
                                    onChange={(e) => setTransferCreditsForm({...transferCreditsForm, toAddress: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="Recipient wallet address"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                                <input
                                    type="number"
                                    value={transferCreditsForm.amount}
                                    onChange={(e) => setTransferCreditsForm({...transferCreditsForm, amount: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mint Address</label>
                                <input
                                    type="text"
                                    value={transferCreditsForm.mintAddress}
                                    onChange={(e) => setTransferCreditsForm({...transferCreditsForm, mintAddress: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="Token mint address"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={transferCreditsHandler.isPending}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                {transferCreditsHandler.isPending ? "Transferring..." : "Transfer Credits"}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Projects List */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Projects</h2>
                    {projectAccounts.isLoading ? (
                        <p className="text-gray-600">Loading projects...</p>
                    ) : projectAccounts.data && projectAccounts.data.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 px-4">ID</th>
                                        <th className="text-left py-2 px-4">Name</th>
                                        <th className="text-left py-2 px-4">Location</th>
                                        <th className="text-left py-2 px-4">Status</th>
                                        <th className="text-left py-2 px-4">Estimated Credits</th>
                                        <th className="text-left py-2 px-4">Issued Credits</th>
                                        <th className="text-left py-2 px-4">Retired Credits</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projectAccounts.data.map((project) => (
                                        <tr key={project.publicKey.toString()} className="border-b">
                                            <td className="py-2 px-4">{project.account.projectId.toString()}</td>
                                            <td className="py-2 px-4">{project.account.name}</td>
                                            <td className="py-2 px-4">{project.account.location}</td>
                                            <td className="py-2 px-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    project.account.status.verified ? 'bg-green-100 text-green-800' :
                                                    project.account.status.suspended ? 'bg-red-100 text-red-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {project.account.status.verified ? 'Verified' :
                                                     project.account.status.suspended ? 'Suspended' :
                                                     'Pending'}
                                                </span>
                                            </td>
                                            <td className="py-2 px-4">{project.account.estimatedCredits.toString()}</td>
                                            <td className="py-2 px-4">{project.account.issuedCredits.toString()}</td>
                                            <td className="py-2 px-4">{project.account.retiredCredits.toString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-600">No projects found</p>
                    )}
                </div>

                {/* Credit Batches */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Credit Batches</h2>
                    {creditBatchAccounts.isLoading ? (
                        <p className="text-gray-600">Loading credit batches...</p>
                    ) : creditBatchAccounts.data && creditBatchAccounts.data.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 px-4">Batch ID</th>
                                        <th className="text-left py-2 px-4">Project ID</th>
                                        <th className="text-left py-2 px-4">Amount</th>
                                        <th className="text-left py-2 px-4">Vintage Year</th>
                                        <th className="text-left py-2 px-4">Retired Amount</th>
                                        <th className="text-left py-2 px-4">Available</th>
                                        <th className="text-left py-2 px-4">Owner</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {creditBatchAccounts.data.map((batch) => (
                                        <tr key={batch.publicKey.toString()} className="border-b">
                                            <td className="py-2 px-4">{batch.account.batchId.toString()}</td>
                                            <td className="py-2 px-4">{batch.account.projectId.toString()}</td>
                                            <td className="py-2 px-4">{batch.account.amount.toString()}</td>
                                            <td className="py-2 px-4">{batch.account.vintageYear}</td>
                                            <td className="py-2 px-4">{batch.account.retiredAmount.toString()}</td>
                                            <td className="py-2 px-4">
                                                {(batch.account.amount.toNumber() - batch.account.retiredAmount.toNumber()).toString()}
                                            </td>
                                            <td className="py-2 px-4 text-xs">
                                                {batch.account.owner.toString().slice(0, 8)}...
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-600">No credit batches found</p>
                    )}
                </div>

                {/* Retirements */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Credit Retirements</h2>
                    {retirementAccounts.isLoading ? (
                        <p className="text-gray-600">Loading retirements...</p>
                    ) : retirementAccounts.data && retirementAccounts.data.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 px-4">Batch ID</th>
                                        <th className="text-left py-2 px-4">Amount</th>
                                        <th className="text-left py-2 px-4">Reason</th>
                                        <th className="text-left py-2 px-4">Retired By</th>
                                        <th className="text-left py-2 px-4">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {retirementAccounts.data.map((retirement) => (
                                        <tr key={retirement.publicKey.toString()} className="border-b">
                                            <td className="py-2 px-4">{retirement.account.batchId.toString()}</td>
                                            <td className="py-2 px-4">{retirement.account.amount.toString()}</td>
                                            <td className="py-2 px-4">{retirement.account.reason}</td>
                                            <td className="py-2 px-4 text-xs">
                                                {retirement.account.retiredBy.toString().slice(0, 8)}...
                                            </td>
                                            <td className="py-2 px-4">
                                                {new Date(retirement.account.retiredAt.toNumber() * 1000).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-600">No retirements found</p>
                    )}
                </div>
            </div>
        </div>
    )
}