import { logger } from '../config/logger';
import { EventEmitter } from 'events';

/**
 * Security Monitor Service
 * Detects and responds to security threats automatically
 * 
 * Requirements: 8.5
 * - Security threat detection and response
 * - Automatic protection measures
 * - Real-time monitoring and alerting
 */

export enum ThreatLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ThreatType {
  BRUTE_FORCE = 'brute_force',
  SQL_INJECTION = 'sql_injection',
  XSS_ATTEMPT = 'xss_attempt',
  DDOS = 'ddos',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  DATA_BREACH_ATTEMPT = 'data_breach_attempt',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
}

export interface SecurityThreat {
  id: string;
  type: ThreatType;
  level: ThreatLevel;
  source: string; // IP address or user ID
  description: string;
  timestamp: Date;
  metadata?: any;
}

export interface SecurityAction {
  type: 'block_ip' | 'suspend_user' | 'alert_admin' | 'log_event' | 'rate_limit';
  target: string;
  reason: string;
  duration?: number; // in seconds
  timestamp: Date;
}

export class SecurityMonitorService extends EventEmitter {
  private threats: Map<string, SecurityThreat[]> = new Map();
  private blockedIPs: Map<string, Date> = new Map();
  private suspendedUsers: Map<string, Date> = new Map();
  private failedAttempts: Map<string, number> = new Map();
  private requestCounts: Map<string, { count: number; resetTime: Date }> = new Map();

  // Configuration
  private readonly config = {
    maxFailedAttempts: 5,
    failedAttemptWindow: 15 * 60 * 1000, // 15 minutes
    blockDuration: 60 * 60 * 1000, // 1 hour
    ddosThreshold: 100, // requests per minute
    ddosWindow: 60 * 1000, // 1 minute
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
  };

  constructor() {
    super();
    this.startCleanupTask();
  }

  /**
   * Record a security threat
   */
  recordThreat(threat: Omit<SecurityThreat, 'id' | 'timestamp'>): SecurityThreat {
    const fullThreat: SecurityThreat = {
      ...threat,
      id: this.generateThreatId(),
      timestamp: new Date(),
    };

    // Store threat
    const sourceThreats = this.threats.get(threat.source) || [];
    sourceThreats.push(fullThreat);
    this.threats.set(threat.source, sourceThreats);

    // Log threat
    logger.warn('Security threat detected', {
      threatId: fullThreat.id,
      type: fullThreat.type,
      level: fullThreat.level,
      source: fullThreat.source,
      description: fullThreat.description,
      metadata: fullThreat.metadata,
    });

    // Emit event
    this.emit('threat', fullThreat);

    // Take automatic action based on threat level
    this.respondToThreat(fullThreat);

    return fullThreat;
  }

  /**
   * Respond to security threat automatically
   */
  private respondToThreat(threat: SecurityThreat): void {
    const actions: SecurityAction[] = [];

    switch (threat.level) {
      case ThreatLevel.CRITICAL:
        // Block IP immediately
        actions.push(this.blockIP(threat.source, 'Critical security threat', 24 * 60 * 60));
        // Alert admins
        actions.push(this.alertAdmins(threat));
        break;

      case ThreatLevel.HIGH:
        // Block IP for shorter duration
        actions.push(this.blockIP(threat.source, 'High security threat', 60 * 60));
        // Alert admins
        actions.push(this.alertAdmins(threat));
        break;

      case ThreatLevel.MEDIUM:
        // Increase monitoring
        actions.push(this.logEvent(threat));
        // Consider rate limiting
        if (this.getRecentThreats(threat.source).length >= 3) {
          actions.push(this.blockIP(threat.source, 'Multiple medium threats', 30 * 60));
        }
        break;

      case ThreatLevel.LOW:
        // Just log
        actions.push(this.logEvent(threat));
        break;
    }

    // Execute actions
    actions.forEach(action => {
      logger.info('Security action taken', action);
      this.emit('action', action);
    });
  }

  /**
   * Block IP address
   */
  blockIP(ip: string, reason: string, durationSeconds: number = 3600): SecurityAction {
    const expiryTime = new Date(Date.now() + durationSeconds * 1000);
    this.blockedIPs.set(ip, expiryTime);

    return {
      type: 'block_ip',
      target: ip,
      reason,
      duration: durationSeconds,
      timestamp: new Date(),
    };
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(ip: string): boolean {
    const expiryTime = this.blockedIPs.get(ip);
    if (!expiryTime) return false;

    if (new Date() > expiryTime) {
      this.blockedIPs.delete(ip);
      return false;
    }

    return true;
  }

  /**
   * Suspend user account
   */
  suspendUser(userId: string, reason: string, durationSeconds: number = 86400): SecurityAction {
    const expiryTime = new Date(Date.now() + durationSeconds * 1000);
    this.suspendedUsers.set(userId, expiryTime);

    return {
      type: 'suspend_user',
      target: userId,
      reason,
      duration: durationSeconds,
      timestamp: new Date(),
    };
  }

  /**
   * Check if user is suspended
   */
  isUserSuspended(userId: string): boolean {
    const expiryTime = this.suspendedUsers.get(userId);
    if (!expiryTime) return false;

    if (new Date() > expiryTime) {
      this.suspendedUsers.delete(userId);
      return false;
    }

    return true;
  }

  /**
   * Record failed authentication attempt
   */
  recordFailedAttempt(source: string): void {
    const attempts = (this.failedAttempts.get(source) || 0) + 1;
    this.failedAttempts.set(source, attempts);

    if (attempts >= this.config.maxFailedAttempts) {
      this.recordThreat({
        type: ThreatType.BRUTE_FORCE,
        level: ThreatLevel.HIGH,
        source,
        description: `${attempts} failed authentication attempts`,
        metadata: { attempts },
      });
    }

    // Clear after window
    setTimeout(() => {
      this.failedAttempts.delete(source);
    }, this.config.failedAttemptWindow);
  }

  /**
   * Check for DDoS attack
   */
  checkDDoS(ip: string): boolean {
    const now = new Date();
    const record = this.requestCounts.get(ip);

    if (!record || now > record.resetTime) {
      // Start new window
      this.requestCounts.set(ip, {
        count: 1,
        resetTime: new Date(now.getTime() + this.config.ddosWindow),
      });
      return false;
    }

    record.count++;

    if (record.count > this.config.ddosThreshold) {
      this.recordThreat({
        type: ThreatType.DDOS,
        level: ThreatLevel.CRITICAL,
        source: ip,
        description: `DDoS attack detected: ${record.count} requests in ${this.config.ddosWindow / 1000}s`,
        metadata: { requestCount: record.count },
      });
      return true;
    }

    return false;
  }

  /**
   * Alert administrators
   */
  private alertAdmins(threat: SecurityThreat): SecurityAction {
    // In production, this would send emails, Slack messages, etc.
    logger.error('SECURITY ALERT: Admin notification required', {
      threatId: threat.id,
      type: threat.type,
      level: threat.level,
      source: threat.source,
      description: threat.description,
    });

    return {
      type: 'alert_admin',
      target: 'admins',
      reason: `${threat.level} threat: ${threat.description}`,
      timestamp: new Date(),
    };
  }

  /**
   * Log security event
   */
  private logEvent(threat: SecurityThreat): SecurityAction {
    return {
      type: 'log_event',
      target: threat.source,
      reason: threat.description,
      timestamp: new Date(),
    };
  }

  /**
   * Get recent threats for a source
   */
  getRecentThreats(source: string, windowMs: number = 60 * 60 * 1000): SecurityThreat[] {
    const threats = this.threats.get(source) || [];
    const cutoff = new Date(Date.now() - windowMs);
    return threats.filter(t => t.timestamp > cutoff);
  }

  /**
   * Get all threats
   */
  getAllThreats(limit: number = 100): SecurityThreat[] {
    const allThreats: SecurityThreat[] = [];
    this.threats.forEach(threats => allThreats.push(...threats));
    return allThreats
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get threat statistics
   */
  getStatistics(): {
    totalThreats: number;
    threatsByType: Record<ThreatType, number>;
    threatsByLevel: Record<ThreatLevel, number>;
    blockedIPs: number;
    suspendedUsers: number;
  } {
    const allThreats = this.getAllThreats(10000);
    
    const threatsByType: Record<ThreatType, number> = {
      [ThreatType.BRUTE_FORCE]: 0,
      [ThreatType.SQL_INJECTION]: 0,
      [ThreatType.XSS_ATTEMPT]: 0,
      [ThreatType.DDOS]: 0,
      [ThreatType.SUSPICIOUS_ACTIVITY]: 0,
      [ThreatType.UNAUTHORIZED_ACCESS]: 0,
      [ThreatType.DATA_BREACH_ATTEMPT]: 0,
      [ThreatType.RATE_LIMIT_EXCEEDED]: 0,
    };

    const threatsByLevel: Record<ThreatLevel, number> = {
      [ThreatLevel.LOW]: 0,
      [ThreatLevel.MEDIUM]: 0,
      [ThreatLevel.HIGH]: 0,
      [ThreatLevel.CRITICAL]: 0,
    };

    allThreats.forEach(threat => {
      threatsByType[threat.type]++;
      threatsByLevel[threat.level]++;
    });

    return {
      totalThreats: allThreats.length,
      threatsByType,
      threatsByLevel,
      blockedIPs: this.blockedIPs.size,
      suspendedUsers: this.suspendedUsers.size,
    };
  }

  /**
   * Clear old threats and expired blocks
   */
  private cleanup(): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours

    // Clean old threats
    this.threats.forEach((threats, source) => {
      const filtered = threats.filter(t => t.timestamp > cutoff);
      if (filtered.length === 0) {
        this.threats.delete(source);
      } else {
        this.threats.set(source, filtered);
      }
    });

    // Clean expired IP blocks
    this.blockedIPs.forEach((expiry, ip) => {
      if (now > expiry) {
        this.blockedIPs.delete(ip);
      }
    });

    // Clean expired user suspensions
    this.suspendedUsers.forEach((expiry, userId) => {
      if (now > expiry) {
        this.suspendedUsers.delete(userId);
      }
    });

    // Clean old request counts
    this.requestCounts.forEach((record, ip) => {
      if (now > record.resetTime) {
        this.requestCounts.delete(ip);
      }
    });

    logger.debug('Security monitor cleanup completed', {
      threatsRemaining: this.threats.size,
      blockedIPs: this.blockedIPs.size,
      suspendedUsers: this.suspendedUsers.size,
    });
  }

  /**
   * Start periodic cleanup task
   */
  private startCleanupTask(): void {
    setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Generate unique threat ID
   */
  private generateThreatId(): string {
    return `threat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Unblock IP address
   */
  unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    logger.info('IP unblocked', { ip });
  }

  /**
   * Unsuspend user
   */
  unsuspendUser(userId: string): void {
    this.suspendedUsers.delete(userId);
    logger.info('User unsuspended', { userId });
  }
}

// Singleton instance
let securityMonitorInstance: SecurityMonitorService | null = null;

/**
 * Get security monitor instance
 */
export function getSecurityMonitor(): SecurityMonitorService {
  if (!securityMonitorInstance) {
    securityMonitorInstance = new SecurityMonitorService();
  }
  return securityMonitorInstance;
}
