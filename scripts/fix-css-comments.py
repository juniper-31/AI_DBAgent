#!/usr/bin/env python3
"""
CSS 파일의 한글 주석을 영문으로 변경하는 스크립트
"""
import re
import os

def fix_css_comments():
    css_file = "frontend/src/styles.css"
    
    # 한글 주석 매핑
    korean_to_english = {
        "/* 오류 섹션 */": "/* Error section */",
        "/* SQL/결과 표 스타일 */": "/* SQL/Result table styles */",
        "/* 입력 영역 개선 */": "/* Input area improvements */",
        "/* RDS 클러스터/인스턴스 트리 테이블 스타일 */": "/* RDS cluster/instance tree table styles */",
        "/* 로딩 인디케이터 */": "/* Loading indicator */",
        "/* 헤더 액션 버튼 */": "/* Header action buttons */",
        "/* 결과가 없을 때 */": "/* When no results */",
        "/* DB 스키마 상태 표시 */": "/* DB schema status display */",
        "/* 사이드바 접힘/펼침 */": "/* Sidebar collapse/expand */",
        "/* AWS 통합 가로 2단 레이아웃 */": "/* AWS integration horizontal 2-column layout */",
        "/* 모달(팝업) 중앙 띄우기 */": "/* Modal popup centering */",
        "/* DB 연결 상태 불(아이콘) */": "/* DB connection status indicator */",
        "/* AI 모델 카드형 UI 스타일 */": "/* AI model card UI styles */",
        "/* CloudWatch 모니터링 개선 스타일 */": "/* CloudWatch monitoring improved styles */",
        "/* 스크롤바 스타일링 */": "/* Scrollbar styling */",
        "/* 폼 컨테이너 개선 */": "/* Form container improvements */",
        "/* 카드 레이아웃 개선 */": "/* Card layout improvements */",
        "/* 테이블 컨테이너 개선 */": "/* Table container improvements */",
        "/* 버튼 그룹 개선 */": "/* Button group improvements */",
        "/* 반응형 개선 */": "/* Responsive improvements */",
        "/* 로딩 상태 개선 */": "/* Loading state improvements */",
        "/* 빈 상태 메시지 개선 */": "/* Empty state message improvements */",
        "/* 알림 메시지 개선 */": "/* Alert message improvements */",
        "/* 폼 스타일 개선 */": "/* Form style improvements */",
        "/* 조회된 데이터베이스 목록 스타일 */": "/* Browsed database list styles */",
        "/* 데이터베이스 목록 테이블 개선 */": "/* Database list table improvements */",
        "/* 연결 상태 인디케이터 개선 */": "/* Connection status indicator improvements */",
        "/* 액션 버튼 그룹 */": "/* Action button group */",
        "/* 플레이북 단계 컨트롤 버튼 */": "/* Playbook step control buttons */",
        "/* 플레이북 메시지 스타일 개선 */": "/* Playbook message style improvements */",
        "/* 플레이북 완료 메시지 */": "/* Playbook completion message */",
        "/* 플레이북 오류 메시지 */": "/* Playbook error message */",
        "/* 플레이북 단계 진행 표시 */": "/* Playbook step progress indicator */",
        "/* 반응형 디자인 개선 */": "/* Responsive design improvements */",
        "/* 페이지별 레이아웃 개선 */": "/* Page-specific layout improvements */",
        "/* MCP Status Styles */": "/* MCP Status Styles */",
    }
    
    if not os.path.exists(css_file):
        print(f"CSS 파일을 찾을 수 없습니다: {css_file}")
        return
    
    # 파일 읽기
    with open(css_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 한글 주석 교체
    for korean, english in korean_to_english.items():
        content = content.replace(korean, english)
    
    # 추가로 한글이 포함된 주석을 찾아서 제거하거나 영문으로 변경
    # 한글 문자가 포함된 주석 패턴 찾기
    korean_comment_pattern = r'/\*[^*]*[\u3131-\u3163\uac00-\ud7a3][^*]*\*/'
    korean_comments = re.findall(korean_comment_pattern, content)
    
    for comment in korean_comments:
        # 간단한 영문 주석으로 교체
        if "페이지" in comment:
            content = content.replace(comment, "/* Page layout */")
        elif "스타일" in comment:
            content = content.replace(comment, "/* Styles */")
        elif "개선" in comment:
            content = content.replace(comment, "/* Improvements */")
        elif "컨테이너" in comment:
            content = content.replace(comment, "/* Container */")
        elif "버튼" in comment:
            content = content.replace(comment, "/* Button */")
        elif "테이블" in comment:
            content = content.replace(comment, "/* Table */")
        elif "폼" in comment:
            content = content.replace(comment, "/* Form */")
        elif "카드" in comment:
            content = content.replace(comment, "/* Card */")
        elif "모달" in comment:
            content = content.replace(comment, "/* Modal */")
        elif "사이드바" in comment:
            content = content.replace(comment, "/* Sidebar */")
        else:
            # 기본적으로 영문 주석으로 교체
            content = content.replace(comment, "/* Styles */")
    
    # 파일 쓰기
    with open(css_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("CSS 파일의 한글 주석을 영문으로 변경했습니다.")
    print(f"변경된 파일: {css_file}")

if __name__ == "__main__":
    fix_css_comments()