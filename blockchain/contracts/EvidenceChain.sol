// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title EvidenceChain
 * @dev Smart contract for storing digital evidence metadata on blockchain with approval workflow
 */
contract EvidenceChain {
    
    enum EvidenceStatus { Uploaded, PoliceVerified, AdminApproved, CourtSubmitted }
    enum UserRole { Citizen, Police, Forensic, Court, Admin }
    
    struct Case {
        string caseId;
        string caseName;
        string description;
        uint256 createdAt;
        address createdBy;
        bool isActive;
        bool exists;
    }
    
    struct Evidence {
        string evidenceId;
        string hash;
        string caseId;
        string caseNumber;
        uint256 timestamp;
        address uploadedBy;
        EvidenceStatus status;
        address verifiedBy;
        address approvedBy;
        uint256 verifiedAt;
        uint256 approvedAt;
        bool encrypted;
        string encryptionKey;
        bool exists;
    }
    
    struct AuditLog {
        string action;
        address performedBy;
        uint256 timestamp;
        string details;
        UserRole role;
    }
    
    struct User {
        address userAddress;
        UserRole role;
        bool isActive;
        bool kycVerified;
        uint256 registeredAt;
    }
    
    // Mapping from caseId to Case
    mapping(string => Case) public cases;
    
    // Mapping from evidenceId to Evidence
    mapping(string => Evidence) public evidenceRegistry;
    
    // Mapping from evidenceId to array of audit logs
    mapping(string => AuditLog[]) public auditLogs;
    
    // Mapping from address to User
    mapping(address => User) public users;
    
    // Mapping from user address to array of authorized case IDs
    mapping(address => string[]) public userCases;
    
    // Mapping from caseId to array of evidence IDs
    mapping(string => string[]) public caseEvidenceIds;
    
    // Array of all evidence IDs
    string[] public evidenceIds;
    
    // Array of all case IDs
    string[] public caseIds;
    
    // Contract owner
    address public owner;
    
    // Events
    event EvidenceStored(
        string indexed evidenceId,
        string hash,
        string caseNumber,
        address indexed uploadedBy,
        uint256 timestamp
    );
    
    event EvidenceVerified(
        string indexed evidenceId,
        address indexed verifiedBy,
        uint256 timestamp
    );
    
    event EvidenceApproved(
        string indexed evidenceId,
        address indexed approvedBy,
        uint256 timestamp
    );
    
    event AuditLogAdded(
        string indexed evidenceId,
        string action,
        address indexed performedBy,
        uint256 timestamp
    );
    
    event UserRegistered(
        address indexed userAddress,
        UserRole role,
        uint256 timestamp
    );
    
    event UnauthorizedAccess(
        address indexed attemptedBy,
        string action,
        uint256 timestamp
    );
    
    event CaseCreated(
        string indexed caseId,
        string caseName,
        address indexed createdBy,
        uint256 timestamp
    );
    
    event UserAssignedToCase(
        address indexed userAddress,
        string indexed caseId,
        uint256 timestamp
    );
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }
    
    modifier onlyRole(UserRole _role) {
        require(users[msg.sender].isActive, "User is not active");
        require(users[msg.sender].kycVerified, "User KYC not verified");
        require(users[msg.sender].role == _role, "Unauthorized role");
        _;
    }
    
    modifier onlyKYCVerified() {
        require(users[msg.sender].kycVerified, "KYC verification required");
        _;
    }
    
    modifier hasAccessToCase(string memory _caseId) {
        require(cases[_caseId].exists, "Case does not exist");
        bool hasAccess = false;
        
        // Admin has access to all cases
        if (users[msg.sender].role == UserRole.Admin) {
            hasAccess = true;
        } else {
            // Check if user is assigned to this case
            string[] memory userCaseList = userCases[msg.sender];
            for (uint i = 0; i < userCaseList.length; i++) {
                if (keccak256(abi.encodePacked(userCaseList[i])) == keccak256(abi.encodePacked(_caseId))) {
                    hasAccess = true;
                    break;
                }
            }
        }
        
        require(hasAccess, "User does not have access to this case");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        users[msg.sender] = User({
            userAddress: msg.sender,
            role: UserRole.Admin,
            isActive: true,
            kycVerified: true,
            registeredAt: block.timestamp
        });
    }
    
    /**
     * @dev Create a new case (Admin only)
     */
    function createCase(
        string memory _caseId,
        string memory _caseName,
        string memory _description
    ) public onlyOwner returns (bool) {
        require(!cases[_caseId].exists, "Case already exists");
        
        cases[_caseId] = Case({
            caseId: _caseId,
            caseName: _caseName,
            description: _description,
            createdAt: block.timestamp,
            createdBy: msg.sender,
            isActive: true,
            exists: true
        });
        
        caseIds.push(_caseId);
        
        emit CaseCreated(_caseId, _caseName, msg.sender, block.timestamp);
        return true;
    }
    
    /**
     * @dev Assign user to case (Admin only)
     */
    function assignUserToCase(address _userAddress, string memory _caseId) public onlyOwner returns (bool) {
        require(users[_userAddress].isActive, "User not registered");
        require(cases[_caseId].exists, "Case does not exist");
        
        userCases[_userAddress].push(_caseId);
        
        emit UserAssignedToCase(_userAddress, _caseId, block.timestamp);
        return true;
    }
    
    /**
     * @dev Get user's assigned cases
     */
    function getUserCases(address _userAddress) public view returns (string[] memory) {
        return userCases[_userAddress];
    }
    
    /**
     * @dev Get case details
     */
    function getCase(string memory _caseId) 
        public 
        view 
        returns (
            string memory caseId,
            string memory caseName,
            string memory description,
            uint256 createdAt,
            address createdBy,
            bool isActive
        ) 
    {
        require(cases[_caseId].exists, "Case does not exist");
        
        Case memory c = cases[_caseId];
        return (
            c.caseId,
            c.caseName,
            c.description,
            c.createdAt,
            c.createdBy,
            c.isActive
        );
    }
    
    /**
     * @dev Register a new user (Admin only)
     */
    function registerUser(address _userAddress, UserRole _role) public onlyOwner returns (bool) {
        require(!users[_userAddress].isActive, "User already registered");
        
        users[_userAddress] = User({
            userAddress: _userAddress,
            role: _role,
            isActive: true,
            kycVerified: false,
            registeredAt: block.timestamp
        });
        
        emit UserRegistered(_userAddress, _role, block.timestamp);
        return true;
    }
    
    /**
     * @dev Verify user KYC (Admin only)
     */
    function verifyUserKYC(address _userAddress) public onlyOwner returns (bool) {
        require(users[_userAddress].isActive, "User not registered");
        users[_userAddress].kycVerified = true;
        return true;
    }
    
    /**
     * @dev Deactivate user (Admin only)
     */
    function deactivateUser(address _userAddress) public onlyOwner returns (bool) {
        require(users[_userAddress].isActive, "User not active");
        users[_userAddress].isActive = false;
        return true;
    }
    
    /**
     * @dev Get user details
     */
    function getUser(address _userAddress) 
        public 
        view 
        returns (
            address userAddress,
            UserRole role,
            bool isActive,
            bool kycVerified,
            uint256 registeredAt
        ) 
    {
        User memory user = users[_userAddress];
        return (
            user.userAddress,
            user.role,
            user.isActive,
            user.kycVerified,
            user.registeredAt
        );
    }
    
    /**
     * @dev Store evidence metadata on blockchain with Case ID
     */
    function storeEvidence(
        string memory _evidenceId,
        string memory _hash,
        string memory _caseId,
        string memory _caseNumber,
        uint256 _timestamp
    ) public onlyKYCVerified hasAccessToCase(_caseId) returns (bool) {
        require(!evidenceRegistry[_evidenceId].exists, "Evidence already exists");
        require(cases[_caseId].isActive, "Case is not active");
        
        evidenceRegistry[_evidenceId] = Evidence({
            evidenceId: _evidenceId,
            hash: _hash,
            caseId: _caseId,
            caseNumber: _caseNumber,
            timestamp: _timestamp,
            uploadedBy: msg.sender,
            status: EvidenceStatus.Uploaded,
            verifiedBy: address(0),
            approvedBy: address(0),
            verifiedAt: 0,
            approvedAt: 0,
            encrypted: false,
            encryptionKey: "",
            exists: true
        });
        
        evidenceIds.push(_evidenceId);
        caseEvidenceIds[_caseId].push(_evidenceId);
        
        // Add initial audit log
        auditLogs[_evidenceId].push(AuditLog({
            action: "upload",
            performedBy: msg.sender,
            timestamp: block.timestamp,
            details: string(abi.encodePacked("Evidence uploaded to case: ", _caseId)),
            role: users[msg.sender].role
        }));
        
        emit EvidenceStored(_evidenceId, _hash, _caseNumber, msg.sender, _timestamp);
        
        return true;
    }
    
    /**
     * @dev Get all evidence IDs for a specific case
     */
    function getCaseEvidence(string memory _caseId) 
        public 
        view 
        hasAccessToCase(_caseId)
        returns (string[] memory) 
    {
        return caseEvidenceIds[_caseId];
    }
    
    /**
     * @dev Police verifies evidence
     */
    function policeVerifyEvidence(string memory _evidenceId) public onlyRole(UserRole.Police) returns (bool) {
        require(evidenceRegistry[_evidenceId].exists, "Evidence does not exist");
        require(evidenceRegistry[_evidenceId].status == EvidenceStatus.Uploaded, "Evidence already verified");
        
        evidenceRegistry[_evidenceId].status = EvidenceStatus.PoliceVerified;
        evidenceRegistry[_evidenceId].verifiedBy = msg.sender;
        evidenceRegistry[_evidenceId].verifiedAt = block.timestamp;
        
        auditLogs[_evidenceId].push(AuditLog({
            action: "police_verify",
            performedBy: msg.sender,
            timestamp: block.timestamp,
            details: "Evidence verified by police",
            role: UserRole.Police
        }));
        
        emit EvidenceVerified(_evidenceId, msg.sender, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Admin approves evidence
     */
    function adminApproveEvidence(string memory _evidenceId) public onlyRole(UserRole.Admin) returns (bool) {
        require(evidenceRegistry[_evidenceId].exists, "Evidence does not exist");
        require(evidenceRegistry[_evidenceId].status == EvidenceStatus.PoliceVerified, "Evidence not verified by police");
        
        evidenceRegistry[_evidenceId].status = EvidenceStatus.AdminApproved;
        evidenceRegistry[_evidenceId].approvedBy = msg.sender;
        evidenceRegistry[_evidenceId].approvedAt = block.timestamp;
        
        auditLogs[_evidenceId].push(AuditLog({
            action: "admin_approve",
            performedBy: msg.sender,
            timestamp: block.timestamp,
            details: "Evidence approved by admin",
            role: UserRole.Admin
        }));
        
        emit EvidenceApproved(_evidenceId, msg.sender, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Submit evidence to court
     */
    function submitToCourt(string memory _evidenceId) public onlyRole(UserRole.Admin) returns (bool) {
        require(evidenceRegistry[_evidenceId].exists, "Evidence does not exist");
        require(evidenceRegistry[_evidenceId].status == EvidenceStatus.AdminApproved, "Evidence not approved");
        
        evidenceRegistry[_evidenceId].status = EvidenceStatus.CourtSubmitted;
        
        auditLogs[_evidenceId].push(AuditLog({
            action: "court_submit",
            performedBy: msg.sender,
            timestamp: block.timestamp,
            details: "Evidence submitted to court",
            role: UserRole.Admin
        }));
        
        return true;
    }
    
    /**
     * @dev Get evidence details
     */
    function getEvidence(string memory _evidenceId) 
        public 
        view 
        returns (
            string memory evidenceId,
            string memory hash,
            string memory caseNumber,
            uint256 timestamp,
            address uploadedBy
        ) 
    {
        require(evidenceRegistry[_evidenceId].exists, "Evidence does not exist");
        
        Evidence memory evidence = evidenceRegistry[_evidenceId];
        return (
            evidence.evidenceId,
            evidence.hash,
            evidence.caseNumber,
            evidence.timestamp,
            evidence.uploadedBy
        );
    }
    
    /**
     * @dev Add audit log entry
     */
    function addAuditLog(
        string memory _evidenceId,
        string memory _action,
        string memory _details
    ) public returns (bool) {
        require(evidenceRegistry[_evidenceId].exists, "Evidence does not exist");
        
        auditLogs[_evidenceId].push(AuditLog({
            action: _action,
            performedBy: msg.sender,
            timestamp: block.timestamp,
            details: _details,
            role: users[msg.sender].role
        }));
        
        emit AuditLogAdded(_evidenceId, _action, msg.sender, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Get audit log count for evidence
     */
    function getAuditLogCount(string memory _evidenceId) 
        public 
        view 
        returns (uint256) 
    {
        return auditLogs[_evidenceId].length;
    }
    
    /**
     * @dev Get specific audit log entry
     */
    function getAuditLog(string memory _evidenceId, uint256 _index)
        public
        view
        returns (
            string memory action,
            address performedBy,
            uint256 timestamp,
            string memory details
        )
    {
        require(_index < auditLogs[_evidenceId].length, "Index out of bounds");
        
        AuditLog memory log = auditLogs[_evidenceId][_index];
        return (log.action, log.performedBy, log.timestamp, log.details);
    }
    
    /**
     * @dev Verify evidence hash
     */
    function verifyEvidence(string memory _evidenceId, string memory _hash)
        public
        view
        returns (bool)
    {
        require(evidenceRegistry[_evidenceId].exists, "Evidence does not exist");
        
        return keccak256(abi.encodePacked(evidenceRegistry[_evidenceId].hash)) == 
               keccak256(abi.encodePacked(_hash));
    }
  
    /**
     * @dev Get total evidence count
     */
    function getTotalEvidenceCount() public view returns (uint256) {
        return evidenceIds.length;
    }
    
    /**
     * @dev Check if evidence exists
     */
    function evidenceExists(string memory _evidenceId) public view returns (bool) {
        return evidenceRegistry[_evidenceId].exists;
    }
}
