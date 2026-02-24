import { SecurityMonitorService, ThreatLevel, ThreatType } from '../services/security-monitor.service';

describe('SecurityMonitorService', () => {
  let securityMonitor: SecurityMonitorService;

  beforeEach(() => {
    securityMonitor = new SecurityMonitorService();
  });

  afterEach(() => {
    securityMonitor.removeAllListeners();
  });

  describe('recordThreat', () => {
    it('should record a security threat', () => {
      const threat = securityMonitor.recordThreat({
        type: ThreatType.SUSPICIOUS_ACTIVITY,
        level: ThreatLevel.LOW,
        source: '192.168.1.1',
        description: 'Test threat',
      });

      expect(threat.id).toBeTruthy();
      expect(threat.timestamp).toBeInstanceOf(Date);
      expect(threat.type).toBe(ThreatType.SUSPICIOUS_ACTIVITY);
      expect(threat.level).toBe(ThreatLevel.LOW);
    });

    it('should emit threat event', (done) => {
      securityMonitor.on('threat', (threat) => {
        expect(threat.type).toBe(ThreatType.XSS_ATTEMPT);
        done();
      });

      securityMonitor.recordThreat({
        type: ThreatType.XSS_ATTEMPT,
        level: ThreatLevel.MEDIUM,
        source: '192.168.1.2',
        description: 'XSS attempt detected',
      });
    });

    it('should block IP on critical threat', (done) => {
      securityMonitor.on('action', (action) => {
        if (action.type === 'block_ip') {
          expect(action.target).toBe('192.168.1.3');
          done();
        }
      });

      securityMonitor.recordThreat({
        type: ThreatType.DDOS,
        level: ThreatLevel.CRITICAL,
        source: '192.168.1.3',
        description: 'DDoS attack',
      });
    });
  });

  describe('blockIP and isIPBlocked', () => {
    it('should block IP address', () => {
      const ip = '192.168.1.10';
      securityMonitor.blockIP(ip, 'Test block', 60);

      expect(securityMonitor.isIPBlocked(ip)).toBe(true);
    });

    it('should unblock IP after duration', (done) => {
      const ip = '192.168.1.11';
      securityMonitor.blockIP(ip, 'Test block', 1); // 1 second

      expect(securityMonitor.isIPBlocked(ip)).toBe(true);

      setTimeout(() => {
        expect(securityMonitor.isIPBlocked(ip)).toBe(false);
        done();
      }, 1100);
    });

    it('should manually unblock IP', () => {
      const ip = '192.168.1.12';
      securityMonitor.blockIP(ip, 'Test block', 3600);

      expect(securityMonitor.isIPBlocked(ip)).toBe(true);

      securityMonitor.unblockIP(ip);

      expect(securityMonitor.isIPBlocked(ip)).toBe(false);
    });
  });

  describe('suspendUser and isUserSuspended', () => {
    it('should suspend user account', () => {
      const userId = 'user-123';
      securityMonitor.suspendUser(userId, 'Test suspension', 60);

      expect(securityMonitor.isUserSuspended(userId)).toBe(true);
    });

    it('should unsuspend user after duration', (done) => {
      const userId = 'user-124';
      securityMonitor.suspendUser(userId, 'Test suspension', 1); // 1 second

      expect(securityMonitor.isUserSuspended(userId)).toBe(true);

      setTimeout(() => {
        expect(securityMonitor.isUserSuspended(userId)).toBe(false);
        done();
      }, 1100);
    });

    it('should manually unsuspend user', () => {
      const userId = 'user-125';
      securityMonitor.suspendUser(userId, 'Test suspension', 3600);

      expect(securityMonitor.isUserSuspended(userId)).toBe(true);

      securityMonitor.unsuspendUser(userId);

      expect(securityMonitor.isUserSuspended(userId)).toBe(false);
    });
  });

  describe('recordFailedAttempt', () => {
    it('should record failed authentication attempts', () => {
      const source = '192.168.1.20';

      for (let i = 0; i < 3; i++) {
        securityMonitor.recordFailedAttempt(source);
      }

      const threats = securityMonitor.getRecentThreats(source);
      expect(threats.length).toBe(0); // Not enough attempts yet
    });

    it('should create threat after max failed attempts', (done) => {
      const source = '192.168.1.21';

      securityMonitor.on('threat', (threat) => {
        if (threat.type === ThreatType.BRUTE_FORCE) {
          expect(threat.source).toBe(source);
          done();
        }
      });

      for (let i = 0; i < 5; i++) {
        securityMonitor.recordFailedAttempt(source);
      }
    });
  });

  describe('checkDDoS', () => {
    it('should detect DDoS attack', () => {
      const ip = '192.168.1.30';

      // Simulate many requests
      for (let i = 0; i < 101; i++) {
        securityMonitor.checkDDoS(ip);
      }

      const threats = securityMonitor.getRecentThreats(ip);
      const ddosThreats = threats.filter(t => t.type === ThreatType.DDOS);

      expect(ddosThreats.length).toBeGreaterThan(0);
    });

    it('should not detect DDoS for normal traffic', () => {
      const ip = '192.168.1.31';

      // Simulate normal requests
      for (let i = 0; i < 50; i++) {
        securityMonitor.checkDDoS(ip);
      }

      const threats = securityMonitor.getRecentThreats(ip);
      const ddosThreats = threats.filter(t => t.type === ThreatType.DDOS);

      expect(ddosThreats.length).toBe(0);
    });
  });

  describe('getRecentThreats', () => {
    it('should return recent threats for source', () => {
      const source = '192.168.1.40';

      securityMonitor.recordThreat({
        type: ThreatType.SUSPICIOUS_ACTIVITY,
        level: ThreatLevel.LOW,
        source,
        description: 'Test 1',
      });

      securityMonitor.recordThreat({
        type: ThreatType.XSS_ATTEMPT,
        level: ThreatLevel.MEDIUM,
        source,
        description: 'Test 2',
      });

      const threats = securityMonitor.getRecentThreats(source);

      expect(threats.length).toBe(2);
      expect(threats[0].source).toBe(source);
      expect(threats[1].source).toBe(source);
    });

    it('should filter by time window', () => {
      const source = '192.168.1.41';

      securityMonitor.recordThreat({
        type: ThreatType.SUSPICIOUS_ACTIVITY,
        level: ThreatLevel.LOW,
        source,
        description: 'Test',
      });

      // Get threats from last 1ms (should be empty)
      const threats = securityMonitor.getRecentThreats(source, 1);

      expect(threats.length).toBe(0);
    });
  });

  describe('getAllThreats', () => {
    it('should return all threats', () => {
      securityMonitor.recordThreat({
        type: ThreatType.SUSPICIOUS_ACTIVITY,
        level: ThreatLevel.LOW,
        source: '192.168.1.50',
        description: 'Test 1',
      });

      securityMonitor.recordThreat({
        type: ThreatType.XSS_ATTEMPT,
        level: ThreatLevel.MEDIUM,
        source: '192.168.1.51',
        description: 'Test 2',
      });

      const threats = securityMonitor.getAllThreats();

      expect(threats.length).toBeGreaterThanOrEqual(2);
    });

    it('should limit results', () => {
      for (let i = 0; i < 10; i++) {
        securityMonitor.recordThreat({
          type: ThreatType.SUSPICIOUS_ACTIVITY,
          level: ThreatLevel.LOW,
          source: `192.168.1.${60 + i}`,
          description: `Test ${i}`,
        });
      }

      const threats = securityMonitor.getAllThreats(5);

      expect(threats.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getStatistics', () => {
    it('should return threat statistics', () => {
      securityMonitor.recordThreat({
        type: ThreatType.BRUTE_FORCE,
        level: ThreatLevel.HIGH,
        source: '192.168.1.70',
        description: 'Test',
      });

      securityMonitor.recordThreat({
        type: ThreatType.SQL_INJECTION,
        level: ThreatLevel.CRITICAL,
        source: '192.168.1.71',
        description: 'Test',
      });

      const stats = securityMonitor.getStatistics();

      expect(stats.totalThreats).toBeGreaterThanOrEqual(2);
      expect(stats.threatsByType[ThreatType.BRUTE_FORCE]).toBeGreaterThanOrEqual(1);
      expect(stats.threatsByType[ThreatType.SQL_INJECTION]).toBeGreaterThanOrEqual(1);
      expect(stats.threatsByLevel[ThreatLevel.HIGH]).toBeGreaterThanOrEqual(1);
      expect(stats.threatsByLevel[ThreatLevel.CRITICAL]).toBeGreaterThanOrEqual(1);
    });
  });
});
